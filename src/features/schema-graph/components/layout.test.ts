import { describe, expect, it } from "vitest";
import { SchemaGraph as SchemaGraphType } from "../types";
import {
  buildNodeHeightMap,
  getMaxPositionedNodeBottom,
  getNodeHeight,
  getPositionedBounds,
  layoutItemsInGridRows,
  layoutLayeredLeftToRight,
  layoutSideBands,
} from "./layout";
import { getTableViewNodeHeight } from "./node-geometry";

function buildColumns(count: number) {
  return Array.from({ length: count }, (_, idx) => ({
    name: `col_${idx}`,
    dataType: "int",
    isNullable: true,
    isPrimaryKey: idx === 0,
  }));
}

function buildSchema(): SchemaGraphType {
  return {
    tables: [
      { id: "dbo.big", name: "big", schema: "dbo", columns: buildColumns(300) },
      {
        id: "dbo.small",
        name: "small",
        schema: "dbo",
        columns: buildColumns(4),
      },
      {
        id: "dbo.medium",
        name: "medium",
        schema: "dbo",
        columns: buildColumns(20),
      },
    ],
    views: [
      {
        id: "dbo.v_big",
        name: "v_big",
        schema: "dbo",
        columns: buildColumns(120),
        definition: "select 1",
        referencedTables: [],
      },
    ],
    relationships: [],
    triggers: [],
    storedProcedures: [],
    scalarFunctions: [],
  };
}

function assertNoOverlap(
  positions: Record<string, { x: number; y: number }>,
  widths: Map<string, number>,
  heights: Map<string, number>
) {
  const entries = Object.entries(positions);
  for (let i = 0; i < entries.length; i++) {
    const [idA, posA] = entries[i];
    const widthA = widths.get(idA) ?? 300;
    const heightA = heights.get(idA) ?? 150;
    const aLeft = posA.x;
    const aRight = posA.x + widthA;
    const aTop = posA.y;
    const aBottom = posA.y + heightA;

    for (let j = i + 1; j < entries.length; j++) {
      const [idB, posB] = entries[j];
      const widthB = widths.get(idB) ?? 300;
      const heightB = heights.get(idB) ?? 150;
      const bLeft = posB.x;
      const bRight = posB.x + widthB;
      const bTop = posB.y;
      const bBottom = posB.y + heightB;

      const intersectsY = aTop < bBottom && bTop < aBottom;
      if (!intersectsY) continue;

      const intersectsX = aLeft < bRight && bLeft < aRight;
      expect(intersectsX).toBe(false);
    }
  }
}

describe("layout helpers", () => {
  it("places the next row below the tallest node in the previous row", () => {
    const schema = buildSchema();
    const nodeHeights = buildNodeHeightMap(schema);

    const layout = layoutItemsInGridRows(schema.tables, {
      startY: 0,
      cols: 2,
      nodeWidth: 300,
      gapX: 120,
      gapY: 100,
      getHeight: (nodeId) => getNodeHeight(nodeHeights, nodeId),
    });

    const tallestFirstRow = getTableViewNodeHeight(300);
    expect(layout.positions["dbo.medium"].y).toBe(tallestFirstRow + 100);
  });

  it("starts views below the true table section bottom", () => {
    const schema = buildSchema();
    const nodeHeights = buildNodeHeightMap(schema);

    const tableLayout = layoutItemsInGridRows(schema.tables, {
      startY: 0,
      cols: 3,
      nodeWidth: 300,
      gapX: 120,
      gapY: 100,
      getHeight: (nodeId) => getNodeHeight(nodeHeights, nodeId),
    });

    const viewLayout = layoutItemsInGridRows(schema.views, {
      startY: tableLayout.nextY,
      cols: 3,
      nodeWidth: 300,
      gapX: 120,
      gapY: 100,
      getHeight: (nodeId) => getNodeHeight(nodeHeights, nodeId),
    });

    const tableBottoms = Object.entries(tableLayout.positions).map(
      ([nodeId, pos]) => pos.y + getNodeHeight(nodeHeights, nodeId)
    );
    const maxTableBottom = Math.max(...tableBottoms, 0);

    expect(viewLayout.positions["dbo.v_big"].y).toBe(maxTableBottom + 100);
  });

  it("computes compact layout bottom from node bottoms, not top Y values", () => {
    const positions = new Map<string, { x: number; y: number }>([
      ["focused", { x: 0, y: 0 }],
      ["tall_downstream", { x: 0, y: 1000 }],
    ]);
    const heights = new Map<string, number>([
      ["focused", 400],
      ["tall_downstream", 1200],
    ]);

    const maxBottom = getMaxPositionedNodeBottom(positions, (nodeId) =>
      getNodeHeight(heights, nodeId)
    );
    const procedureStartY = maxBottom + 100;

    expect(maxBottom).toBe(2200);
    expect(procedureStartY).toBe(2300);
  });

  it("keeps non-cyclic overview edges flowing left to right", () => {
    const schema = buildSchema();
    const nodeHeights = buildNodeHeightMap(schema);
    const widths = new Map<string, number>([
      ["dbo.big", 700],
      ["dbo.small", 280],
      ["dbo.medium", 460],
      ["dbo.v_big", 540],
    ]);

    const nodeIds = [
      ...schema.tables.map((table) => table.id),
      ...schema.views.map((view) => view.id),
    ];
    const edges = [
      { from: "dbo.big", to: "dbo.small" },
      { from: "dbo.small", to: "dbo.medium" },
      { from: "dbo.small", to: "dbo.v_big" },
    ];

    const layout = layoutLayeredLeftToRight({
      nodeIds,
      edges,
      layerGapX: 140,
      laneGapX: 72,
      gapY: 100,
      getHeight: (nodeId) => getNodeHeight(nodeHeights, nodeId),
      getWidth: (nodeId) => widths.get(nodeId) ?? 300,
    });

    expect(layout.positions["dbo.big"].x).toBeLessThanOrEqual(
      layout.positions["dbo.small"].x
    );
    expect(layout.positions["dbo.small"].x).toBeLessThanOrEqual(
      layout.positions["dbo.medium"].x
    );
    expect(layout.positions["dbo.small"].x).toBeLessThanOrEqual(
      layout.positions["dbo.v_big"].x
    );

    assertNoOverlap(layout.positions, widths, nodeHeights);
  });

  it("places side-band upstream and downstream on opposite horizontal sides", () => {
    const schema = buildSchema();
    const nodeHeights = buildNodeHeightMap(schema);
    const widths = new Map<string, number>([
      ["dbo.big", 720],
      ["dbo.small", 360],
      ["dbo.medium", 500],
      ["dbo.v_big", 640],
    ]);

    const left = layoutSideBands({
      nodeIds: ["dbo.big", "dbo.small"],
      direction: "left",
      anchorX: -60,
      bandGapX: 140,
      laneGapX: 72,
      gapY: 100,
      getHeight: (nodeId) => getNodeHeight(nodeHeights, nodeId),
      getWidth: (nodeId) => widths.get(nodeId) ?? 300,
    });
    const right = layoutSideBands({
      nodeIds: ["dbo.medium", "dbo.v_big"],
      direction: "right",
      anchorX: 360,
      bandGapX: 140,
      laneGapX: 72,
      gapY: 100,
      getHeight: (nodeId) => getNodeHeight(nodeHeights, nodeId),
      getWidth: (nodeId) => widths.get(nodeId) ?? 300,
    });

    expect(Math.max(...Object.values(left.positions).map((pos) => pos.x))).toBeLessThan(
      0
    );
    expect(
      Math.min(...Object.values(right.positions).map((pos) => pos.x))
    ).toBeGreaterThan(0);

    assertNoOverlap(left.positions, widths, nodeHeights);
    assertNoOverlap(right.positions, widths, nodeHeights);
  });

  it("keeps variable-width auxiliary lanes below the main cluster", () => {
    const schema = buildSchema();
    const nodeHeights = buildNodeHeightMap(schema);
    const widths = new Map<string, number>([
      ["dbo.big", 680],
      ["dbo.small", 300],
      ["dbo.medium", 420],
      ["dbo.v_big", 560],
      ["aux.trigger", 480],
    ]);

    const mainLayout = layoutLayeredLeftToRight({
      nodeIds: [
        ...schema.tables.map((table) => table.id),
        ...schema.views.map((view) => view.id),
      ],
      edges: [{ from: "dbo.big", to: "dbo.small" }],
      layerGapX: 140,
      laneGapX: 72,
      gapY: 100,
      getHeight: (nodeId) => getNodeHeight(nodeHeights, nodeId),
      getWidth: (nodeId) => widths.get(nodeId) ?? 300,
    });
    const auxLayout = layoutItemsInGridRows([{ id: "aux.trigger" }], {
      startX: mainLayout.bounds.minX,
      startY: mainLayout.bounds.maxBottom + 100,
      cols: 1,
      nodeWidth: 220,
      gapX: 80,
      gapY: 100,
      getHeight: () => 150,
      getWidth: (nodeId) => widths.get(nodeId) ?? 220,
    });
    const auxBounds = getPositionedBounds(
      auxLayout.positions,
      () => 150,
      (nodeId) => widths.get(nodeId) ?? 220
    );

    expect(auxBounds.minY).toBeGreaterThanOrEqual(mainLayout.bounds.maxBottom + 100);
  });
});
