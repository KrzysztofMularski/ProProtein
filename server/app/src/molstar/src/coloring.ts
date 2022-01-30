/**
 * Copyright (c) 2019-2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { CustomElementProperty } from '../mol-model-props/common/custom-element-property';
import { Model, ElementIndex } from '../mol-model/structure';
import { Color } from '../mol-util/color';

let specialIds: number[][][] = [[[]]]

export const setSpecialIds = (arr: number[][][]) => {
    specialIds = [...arr]
}

const shared = {
    getData(model: Model) {
        const map = new Map<ElementIndex, number>();
        const residueIndex = model.atomicHierarchy.residueAtomSegments.index;
        for (let i = 0, _i = model.atomicHierarchy.atoms._rowCount; i < _i; i++) {
            // map.set(i as ElementIndex, specialIds.includes(residueIndex[i]) === true ? 1 : 0)
            // map.set(i as ElementIndex, model.modelNum === residueIndex[i] ? 1 : 0)
            const currentFrame = specialIds.find(frame => frame[0][0] === model.modelNum)
            if (currentFrame)
                map.set(i as ElementIndex, currentFrame[1].includes(i) ? 1 : 0)
            else
                map.set(i as ElementIndex, 0)
        }
        return { value: map };
    },
    coloring: {
        getColor(e) { return e === 0 ? Color(0xcccccc) : Color(0xff0000); },
        defaultColor: Color(0x777777)
    },
    getLabel(e) {
        return e === 0 ? 'Regular region' : 'Special region';
    }
}

export const ColoredResidues = CustomElementProperty.create<number>({
    label: 'Coloring',
    name: 'coloring',
    ...shared
});

export const ColoredResidues2 = CustomElementProperty.create<number>({
    label: 'Coloring2',
    name: 'coloring-2',
    ...shared
});