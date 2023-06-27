/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import { BuiltInTrajectoryFormat } from '../mol-plugin-state/formats/trajectory';
import { createPlugin } from '../mol-plugin-ui';
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

type LoadParams = { url: string, format?: BuiltInTrajectoryFormat, isBinary?: boolean, assemblyId?: string }

class BasicWrapper {
    plugin: PluginUIContext;

    init(target: string | HTMLElement) {
        this.plugin = createPlugin(typeof target === 'string' ? document.getElementById(target)! : target, {
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
                [PluginConfig.Viewport.ShowAnimation, false]
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
                params: { }
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
        setSpecialIds(frames.map(frame => [[frame.shift()], frame]))
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