/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import { BuiltInTrajectoryFormat } from '../mol-plugin-state/formats/trajectory';
import { createPluginUI } from '../mol-plugin-ui/react18';
import { PluginUIContext } from '../mol-plugin-ui/context';
import { DefaultPluginUISpec } from '../mol-plugin-ui/spec';
import { PluginCommands } from '../mol-plugin/commands';
import { PluginConfig } from '../mol-plugin/config';
import { Asset } from '../mol-util/assets';
import { Color } from '../mol-util/color';
import { ColoredResidues, ColoredResidues2 } from './coloring';
import { setSpecialIds } from './coloring';
import './index.html';
require('mol-plugin-ui/skin/light.scss');

import { PluginStateObject } from '../mol-plugin-state/objects';
import { StateTransforms } from '../mol-plugin-state/transforms';
import { StateTransformer } from '../mol-state';
import { ModelFromTrajectory } from '../mol-plugin-state/transforms/model';
import { UpdateTrajectory } from '../mol-plugin-state/actions/structure';

type LoadParams = { url: string, format?: BuiltInTrajectoryFormat, isBinary?: boolean, assemblyId?: string }

class BasicWrapper {
    plugin: PluginUIContext;

    async init(target: string | HTMLElement) {
        this.plugin = await createPluginUI(typeof target === 'string' ? document.getElementById(target)! : target, {
            ...DefaultPluginUISpec(),
            layout: {
                initial: {
                    isExpanded: false,
                    showControls: false,
                }
            },
            components: {
                remoteState: 'none'
            },
            config: [
                [PluginConfig.Viewport.ShowExpand, false],
                [PluginConfig.Viewport.ShowAnimation, true]
            ]
        });

        this.plugin.representation.structure.themes.colorThemeRegistry.add(ColoredResidues.colorThemeProvider!);
        this.plugin.representation.structure.themes.colorThemeRegistry.add(ColoredResidues2.colorThemeProvider!);
        this.plugin.managers.lociLabels.addProvider(ColoredResidues.labelProvider!);
        this.plugin.managers.lociLabels.addProvider(ColoredResidues2.labelProvider!);
        this.plugin.customModelProperties.register(ColoredResidues.propertyProvider, true);
        this.plugin.customModelProperties.register(ColoredResidues2.propertyProvider, true);
    }

    async load({ url, format = 'pdb', isBinary = false, assemblyId = '' }: LoadParams) {
        await this.plugin.clear();

        const data = await this.plugin.builders.data.download({ url: Asset.Url(url), isBinary }, { state: { isGhost: true } });
        const trajectory = await this.plugin.builders.structure.parseTrajectory(data, format);

        await this.plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default', {
            structure: assemblyId ? {
                name: 'assembly',
                params: { id: assemblyId }
            } : {
                name: 'model',
                params: {}
            },
            showUnitcell: false,
            representationPreset: 'auto'
        });
    }

    async downloadAndSetResiduesIndexes(path: string) {
        const response = await fetch(path)
        const text = await response.text()
        this.setSpecialArray(text)
    }

    setBackground(color: number) {
        PluginCommands.Canvas3D.SetSettings(this.plugin, { settings: props => { props.renderer.backgroundColor = Color(color); } });
    }

    setSpecialArray(arrStr: string) {
        const arr = arrStr.replace('\r', '')
        const frames = arr.split('\n').map(frame => frame.split(' ').map(numStr => parseInt(numStr)))
        setSpecialIds(frames.map(frame => [[frame.shift()], frame]) as number[][][])
    }

    async update() {
        await this.coloring.applySpecial2();
        await this.coloring.applySpecial();
    }

    modelFirst() {
        PluginCommands.State.ApplyAction(this.plugin, {
            state: this.plugin.state.data,
            action: UpdateTrajectory.create({ action: 'reset' })
        });
    }

    modelPrev() {
        PluginCommands.State.ApplyAction(this.plugin, {
            state: this.plugin.state.data,
            action: UpdateTrajectory.create({ action: 'advance', by: -1 })
        });
    }

    modelNext() {
        PluginCommands.State.ApplyAction(this.plugin, {
            state: this.plugin.state.data,
            action: UpdateTrajectory.create({ action: 'advance', by: 1 })
        });
    }

    modelLast() {
        const { current, all } = this.getCurrentModelAndNumberOfModels()!;

        PluginCommands.State.ApplyAction(this.plugin, {
            state: this.plugin.state.data,
            action: UpdateTrajectory.create({ action: 'advance', by: all - current })
        });
    }

    goTo(modelNumber: number) {

        const { current } = this.getCurrentModelAndNumberOfModels()!;

        PluginCommands.State.ApplyAction(this.plugin, {
            state: this.plugin.state.data,
            action: UpdateTrajectory.create({ action: 'advance', by: modelNumber - current })
        });
    }

    getCurrentModelAndNumberOfModels(): { current: number; all: number } {
        const state = this.plugin.state.data;

        const models = state.selectQ(q => q.ofTransformer(StateTransforms.Model.ModelFromTrajectory));

        if (models.length === 0) {
            return { current: 0, all: 0 };
        }

        let label = '', count = 0;
        const parents = new Set<string>();
        for (const m of models) {
            if (!m.sourceRef) continue;
            const parent = state.cells.get(m.sourceRef)!.obj as PluginStateObject.Molecule.Trajectory;

            if (!parent) continue;
            if (parent.data.frameCount > 1) {
                if (parents.has(m.sourceRef)) {
                    // do not show the controls if there are 2 models of the same trajectory present
                    return { current: 0, all: 0 };
                }

                parents.add(m.sourceRef);
                count++;
                if (!label) {
                    const idx = (m.transform.params! as StateTransformer.Params<ModelFromTrajectory>).modelIndex;
                    label = `Model ${idx + 1} / ${parent.data.frameCount}`;
                    return { current: idx + 1, all: parent.data.frameCount };
                }
            }
        }
        return { current: 0, all: 0 };
    }

    coloring = {
        applyDefault: async () => {
            this.plugin.dataTransaction(async () => {
                for (const s of this.plugin.managers.structure.hierarchy.current.structures) {
                    await this.plugin.managers.structure.component.updateRepresentationsTheme(s.components, { color: 'default' });
                }
            });
        },
        applySpecial: async () => {
            this.plugin.dataTransaction(async () => {
                for (const s of this.plugin.managers.structure.hierarchy.current.structures) {
                    await this.plugin.managers.structure.component.updateRepresentationsTheme(s.components, { color: ColoredResidues.propertyProvider.descriptor.name as any });
                }
            });
        },
        applySpecial2: async () => {
            this.plugin.dataTransaction(async () => {
                for (const s of this.plugin.managers.structure.hierarchy.current.structures) {
                    await this.plugin.managers.structure.component.updateRepresentationsTheme(s.components, { color: ColoredResidues2.propertyProvider.descriptor.name as any });
                }
            });
        },
    }
}

(window as any).BasicMolStarWrapper = new BasicWrapper();