"use strict";

// Markdown stores distances between cells; controls operate on occupied positions.
function gridEntries(grid) {
    let position = 0;
    return grid.children.map(function (cell, index) {
        if (index) position += cell.step || 1;
        else {
            for (const match of (cell.opening || '').matchAll(/^\s*!grid_step(?:\[(\d+)\])?\s*$/gm))
                position += +(match[1] || 1);
        }
        return {
            cell,
            position
        };
    });
}

function placeGridCells(grid, entries) {
    entries.sort(function (first, second) {
        return first.position - second.position;
    });
    let previous = 0;
    for (const [index, entry] of entries.entries()) {
        const distance = entry.position - previous;
        const prefix = (entry.cell.opening || '').replace(/^\s*!grid_step(?:\[\d+\])?\s*$/gm, '');
        entry.cell.opening = prefix + (index || distance ? '\n\n!grid_step[' + distance + ']\n\n' : '');
        entry.cell.step = distance || 1;
        previous = entry.position;
    }
    grid.children = entries.map(function (entry) {
        return entry.cell;
    });
}

function moveGridCell(grid, id, destination) {
    if (!Number.isInteger(destination) || destination < 0 || destination > 9999) return;
    const entries = gridEntries(grid);
    const source = entries.find(function (entry) {
        return entry.cell.id === id;
    });
    if (!source || source.position === destination) return;
    const occupied = entries.find(function (entry) {
        return entry.position === destination;
    });
    if (occupied) occupied.position = source.position;
    source.position = destination;
    placeGridCells(grid, entries);
}
