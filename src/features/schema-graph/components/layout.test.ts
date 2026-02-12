import { describe, expect, it } from "vitest";
import { SchemaGraph as SchemaGraphType } from "../types";
import {
  buildNodeHeightMap,
  getMaxPositionedNodeBottom,
  getNodeHeight,
  getPositionedBounds,
  layoutAuxGroupsSideBySide,
  layoutItemsInGridRows,
  layoutLayeredLeftToRight,
  layoutRightAnchoredChildren,
  layoutRightAnchoredChildrenByBands,
  layoutSideBands,
} from "./layout";
import { TABLE_VIEW_HEADER_HEIGHT, getTableViewNodeHeight } from "./node-geometry";

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

  it("places right aux group to the right of left group on same startY", () => {
    const heights = new Map<string, number>([
      ["proc.a", 150],
      ["proc.b", 150],
      ["fn.a", 150],
    ]);
    const widths = new Map<string, number>([
      ["proc.a", 240],
      ["proc.b", 220],
      ["fn.a", 180],
    ]);

    const layout = layoutAuxGroupsSideBySide({
      leftNodeIds: ["proc.a", "proc.b"],
      rightNodeIds: ["fn.a"],
      startX: 100,
      startY: 200,
      leftNodeWidthFallback: 220,
      rightNodeWidthFallback: 220,
      gapX: 90,
      gapY: 100,
      laneGapY: 80,
      leftCols: 2,
      rightCols: 1,
      getHeight: (nodeId) => heights.get(nodeId) ?? 150,
      getWidth: (nodeId, fallback) => widths.get(nodeId) ?? fallback,
    });

    expect(layout.positions["proc.a"].y).toBe(200);
    expect(layout.positions["proc.b"].y).toBe(200);
    expect(layout.positions["fn.a"].y).toBe(200);
    expect(layout.positions["fn.a"].x).toBe(740);
    expect(layout.bounds.minY).toBe(200);
  });

  it("computes nextY from taller of the two side-by-side groups", () => {
    const heights = new Map<string, number>([
      ["proc.a", 120],
      ["proc.b", 120],
      ["fn.a", 400],
    ]);

    const layout = layoutAuxGroupsSideBySide({
      leftNodeIds: ["proc.a", "proc.b"],
      rightNodeIds: ["fn.a"],
      startX: 100,
      startY: 200,
      leftNodeWidthFallback: 220,
      rightNodeWidthFallback: 220,
      gapX: 90,
      gapY: 100,
      laneGapY: 80,
      leftCols: 1,
      rightCols: 1,
      getHeight: (nodeId) => heights.get(nodeId) ?? 150,
      getWidth: (_nodeId, fallback) => fallback,
    });

    expect(layout.nextY).toBe(680);
    expect(layout.bounds.maxBottom).toBe(600);
  });

  it("handles empty left group by placing right group at startX", () => {
    const layout = layoutAuxGroupsSideBySide({
      leftNodeIds: [],
      rightNodeIds: ["fn.a"],
      startX: 120,
      startY: 240,
      leftNodeWidthFallback: 220,
      rightNodeWidthFallback: 220,
      gapX: 90,
      gapY: 100,
      laneGapY: 80,
      rightCols: 1,
      getHeight: () => 150,
      getWidth: (_nodeId, fallback) => fallback,
    });

    expect(layout.positions["fn.a"].x).toBe(120);
    expect(layout.positions["fn.a"].y).toBe(240);
  });

  it("handles empty right group without shifting left group", () => {
    const layout = layoutAuxGroupsSideBySide({
      leftNodeIds: ["proc.a"],
      rightNodeIds: [],
      startX: 80,
      startY: 160,
      leftNodeWidthFallback: 220,
      rightNodeWidthFallback: 220,
      gapX: 90,
      gapY: 100,
      laneGapY: 80,
      leftCols: 1,
      getHeight: () => 150,
      getWidth: (_nodeId, fallback) => fallback,
    });

    expect(layout.positions["proc.a"].x).toBe(80);
    expect(layout.positions["proc.a"].y).toBe(160);
    expect(layout.nextY).toBe(390);
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

  it("reduces overview height when rectangular balancing is enabled", () => {
    const nodeIds = Array.from({ length: 30 }, (_, idx) => `dbo.node_${idx}`);
    const nodeHeights = new Map<string, number>(
      nodeIds.map((nodeId, idx) => [nodeId, 220 + (idx % 5) * 30])
    );
    const widths = new Map<string, number>(
      nodeIds.map((nodeId, idx) => [nodeId, 220 + (idx % 3) * 20])
    );

    const baseline = layoutLayeredLeftToRight({
      nodeIds,
      edges: [],
      layerGapX: 140,
      laneGapX: 72,
      gapY: 100,
      maxLanes: 4,
      getHeight: (nodeId) => getNodeHeight(nodeHeights, nodeId),
      getWidth: (nodeId) => widths.get(nodeId) ?? 300,
    });
    const balanced = layoutLayeredLeftToRight({
      nodeIds,
      edges: [],
      layerGapX: 140,
      laneGapX: 72,
      gapY: 100,
      maxLanes: 14,
      targetAspectRatio: 1.35,
      getHeight: (nodeId) => getNodeHeight(nodeHeights, nodeId),
      getWidth: (nodeId) => widths.get(nodeId) ?? 300,
    });

    const baselineHeight = baseline.bounds.maxBottom - baseline.bounds.minY;
    const balancedHeight = balanced.bounds.maxBottom - balanced.bounds.minY;

    expect(balancedHeight).toBeLessThan(baselineHeight);
    assertNoOverlap(balanced.positions, widths, nodeHeights);
  });

  it("keeps left-to-right order with rectangular balancing", () => {
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
      maxLanes: 12,
      targetAspectRatio: 1.35,
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
  });

  it("does not regress overlap guarantees under wider lane counts", () => {
    const nodeIds = Array.from({ length: 22 }, (_, idx) => `dbo.wide_${idx}`);
    const nodeHeights = new Map<string, number>(
      nodeIds.map((nodeId, idx) => [nodeId, 160 + (idx % 7) * 90])
    );
    const widths = new Map<string, number>(
      nodeIds.map((nodeId, idx) => [nodeId, 220 + (idx % 6) * 55])
    );

    const layout = layoutLayeredLeftToRight({
      nodeIds,
      edges: [],
      layerGapX: 140,
      laneGapX: 72,
      gapY: 100,
      maxLanes: 14,
      targetAspectRatio: 1.35,
      getHeight: (nodeId) => getNodeHeight(nodeHeights, nodeId),
      getWidth: (nodeId) => widths.get(nodeId) ?? 300,
    });

    assertNoOverlap(layout.positions, widths, nodeHeights);
  });

  it("places right-anchored children to the right of the parent by default", () => {
    const layout = layoutRightAnchoredChildren({
      childIds: ["trigger.one"],
      getParentId: () => "dbo.parent",
      parentPositions: {
        "dbo.parent": { x: 100, y: 100 },
      },
      getParentWidth: () => 300,
      getParentHeight: () => 200,
      getChildWidth: () => 180,
      getChildHeight: () => 150,
      baseGapX: 48,
      stackGapY: 24,
      collisionStepX: 72,
    });

    expect(layout.positions["trigger.one"].x).toBe(448);
    expect(layout.positions["trigger.one"].y).toBe(125);
    expect(layout.unplacedChildIds).toEqual([]);
  });

  it("stacks multiple right-anchored children for one parent without overlap", () => {
    const childIds = ["trigger.a", "trigger.b", "trigger.c"];
    const widths = new Map(childIds.map((id) => [id, 180]));
    const heights = new Map(childIds.map((id) => [id, 120]));
    const layout = layoutRightAnchoredChildren({
      childIds,
      getParentId: () => "dbo.parent",
      parentPositions: {
        "dbo.parent": { x: 100, y: 100 },
      },
      getParentWidth: () => 300,
      getParentHeight: () => 300,
      getChildWidth: (nodeId) => widths.get(nodeId) ?? 180,
      getChildHeight: (nodeId) => heights.get(nodeId) ?? 120,
      baseGapX: 48,
      stackGapY: 24,
      collisionStepX: 72,
    });

    const yPositions = childIds.map((id) => layout.positions[id].y);
    expect(yPositions[1]).toBeGreaterThan(yPositions[0]);
    expect(yPositions[2]).toBeGreaterThan(yPositions[1]);
    assertNoOverlap(layout.positions, widths, heights);
  });

  it("shifts right-anchored children farther right when occupied nodes collide", () => {
    const layout = layoutRightAnchoredChildren({
      childIds: ["trigger.one"],
      getParentId: () => "dbo.parent",
      parentPositions: {
        "dbo.parent": { x: 0, y: 0 },
      },
      getParentWidth: () => 300,
      getParentHeight: () => 300,
      getChildWidth: () => 180,
      getChildHeight: () => 150,
      baseGapX: 48,
      stackGapY: 24,
      collisionStepX: 72,
      occupiedRects: [{ x: 330, y: 0, width: 220, height: 320 }],
    });

    const initialX = 348;
    expect(layout.positions["trigger.one"].x).toBeGreaterThan(initialX);
  });

  it("returns orphan right-anchored children for fallback placement", () => {
    const layout = layoutRightAnchoredChildren({
      childIds: ["trigger.orphan"],
      getParentId: () => "dbo.missing",
      parentPositions: {},
      getParentWidth: () => 300,
      getParentHeight: () => 200,
      getChildWidth: () => 180,
      getChildHeight: () => 150,
      baseGapX: 48,
      stackGapY: 24,
      collisionStepX: 72,
    });

    expect(layout.positions["trigger.orphan"]).toBeUndefined();
    expect(layout.unplacedChildIds).toEqual(["trigger.orphan"]);
  });

  it("interleaves trigger stacks near parent by band", () => {
    const layout = layoutRightAnchoredChildrenByBands({
      orderedBandIds: ["band0", "band1"],
      parentIdsByBand: new Map([
        ["band0", ["dbo.table_a"]],
        ["band1", ["dbo.table_b"]],
      ]),
      childIdsByParent: new Map([
        ["dbo.table_a", ["dbo.tr_a_1", "dbo.tr_a_2", "dbo.tr_a_3"]],
        ["dbo.table_b", ["dbo.tr_b_1"]],
      ]),
      parentPositions: {
        "dbo.table_a": { x: 0, y: 120 },
        "dbo.table_b": { x: 560, y: 140 },
      },
      getParentWidth: () => 300,
      getParentHeight: () => 220,
      getChildWidth: () => 180,
      getChildHeight: () => 150,
      baseGapX: 48,
      stackGapY: 24,
      minLaneGapX: 72,
      minBandGapX: 140,
    });

    expect(layout.positions["dbo.tr_a_1"].x).toBe(348);
    expect(layout.positions["dbo.tr_a_2"].x).toBe(348);
    expect(layout.positions["dbo.tr_a_3"].x).toBe(348);
    expect(layout.positions["dbo.tr_b_1"].x).toBeGreaterThan(
      layout.positions["dbo.tr_a_1"].x
    );
    expect(layout.parentShiftById.get("dbo.table_a")).toBe(0);
    expect(layout.parentShiftById.get("dbo.table_b")).toBeGreaterThan(0);
    expect(layout.unplacedChildIds).toEqual([]);
  });

  it("anchors trigger stack to a custom start Y in band layout", () => {
    const layout = layoutRightAnchoredChildrenByBands({
      orderedBandIds: ["band0"],
      parentIdsByBand: new Map([["band0", ["dbo.table_a"]]]),
      childIdsByParent: new Map([["dbo.table_a", ["dbo.tr_a_1"]]]),
      parentPositions: {
        "dbo.table_a": { x: 0, y: 120 },
      },
      getParentWidth: () => 300,
      getParentHeight: () => 220,
      getChildWidth: () => 180,
      getChildHeight: () => 150,
      baseGapX: 48,
      stackGapY: 24,
      minLaneGapX: 72,
      minBandGapX: 140,
      getChildStackStartY: ({ parentTopY }) =>
        parentTopY + TABLE_VIEW_HEADER_HEIGHT,
    });

    expect(layout.positions["dbo.tr_a_1"].y).toBe(120 + TABLE_VIEW_HEADER_HEIGHT);
  });

  it("stacks multiple anchored triggers downward from first-column top", () => {
    const layout = layoutRightAnchoredChildrenByBands({
      orderedBandIds: ["band0"],
      parentIdsByBand: new Map([["band0", ["dbo.table_a"]]]),
      childIdsByParent: new Map([
        ["dbo.table_a", ["dbo.tr_a_1", "dbo.tr_a_2"]],
      ]),
      parentPositions: {
        "dbo.table_a": { x: 0, y: 120 },
      },
      getParentWidth: () => 300,
      getParentHeight: () => 220,
      getChildWidth: () => 180,
      getChildHeight: () => 120,
      baseGapX: 48,
      stackGapY: 24,
      minLaneGapX: 72,
      minBandGapX: 140,
      getChildStackStartY: ({ parentTopY }) =>
        parentTopY + TABLE_VIEW_HEADER_HEIGHT,
    });

    const firstY = 120 + TABLE_VIEW_HEADER_HEIGHT;
    expect(layout.positions["dbo.tr_a_1"].y).toBe(firstY);
    expect(layout.positions["dbo.tr_a_2"].y).toBe(firstY + 120 + 24);
  });

  it("clamps anchored trigger start to lane cursor when earlier stacks occupy space", () => {
    const layout = layoutRightAnchoredChildrenByBands({
      orderedBandIds: ["band0"],
      parentIdsByBand: new Map([
        ["band0", ["dbo.table_a", "dbo.table_b"]],
      ]),
      childIdsByParent: new Map([
        ["dbo.table_a", ["dbo.tr_a_1"]],
        ["dbo.table_b", ["dbo.tr_b_1"]],
      ]),
      parentPositions: {
        "dbo.table_a": { x: 0, y: 120 },
        "dbo.table_b": { x: 0, y: 240 },
      },
      getParentWidth: () => 300,
      getParentHeight: () => 220,
      getChildWidth: () => 180,
      getChildHeight: () => 180,
      baseGapX: 48,
      stackGapY: 24,
      minLaneGapX: 72,
      minBandGapX: 140,
      getChildStackStartY: ({ parentTopY }) =>
        parentTopY + TABLE_VIEW_HEADER_HEIGHT,
    });

    const firstY = layout.positions["dbo.tr_a_1"].y;
    const secondAnchoredY = 240 + TABLE_VIEW_HEADER_HEIGHT;
    const secondY = layout.positions["dbo.tr_b_1"].y;
    expect(secondY).toBe(firstY + 180 + 24);
    expect(secondY).toBeGreaterThan(secondAnchoredY);
  });

  it("shifts next lane right when prior lane has trigger sidecar", () => {
    const layout = layoutRightAnchoredChildrenByBands({
      orderedBandIds: ["band0"],
      parentIdsByBand: new Map([
        ["band0", ["dbo.table_a", "dbo.table_b"]],
      ]),
      childIdsByParent: new Map([["dbo.table_a", ["dbo.tr_a_1"]]]),
      parentPositions: {
        "dbo.table_a": { x: 0, y: 120 },
        "dbo.table_b": { x: 320, y: 120 },
      },
      getParentWidth: () => 300,
      getParentHeight: () => 200,
      getChildWidth: () => 180,
      getChildHeight: () => 150,
      baseGapX: 48,
      stackGapY: 24,
      minLaneGapX: 72,
      minBandGapX: 140,
    });

    const shiftA = layout.parentShiftById.get("dbo.table_a") ?? 0;
    const shiftB = layout.parentShiftById.get("dbo.table_b") ?? 0;
    expect(shiftA).toBe(0);
    expect(shiftB).toBeGreaterThan(0);

    const trigger = layout.positions["dbo.tr_a_1"];
    expect(trigger.x).toBe(348);

    const shiftedTableBLeft = 320 + shiftB;
    const triggerRight = trigger.x + 180;
    expect(shiftedTableBLeft).toBeGreaterThanOrEqual(triggerRight + 72);
  });

  it("uses a single reserved trigger X per lane with triggers", () => {
    const triggerIds = [
      "dbo.tr_a_1",
      "dbo.tr_a_2",
      "dbo.tr_b_1",
      "dbo.tr_b_2",
    ];
    const widths = new Map(triggerIds.map((id) => [id, 180]));
    const heights = new Map(triggerIds.map((id) => [id, 140]));

    const layout = layoutRightAnchoredChildrenByBands({
      orderedBandIds: ["band0"],
      parentIdsByBand: new Map([
        ["band0", ["dbo.table_a", "dbo.table_b"]],
      ]),
      childIdsByParent: new Map([
        ["dbo.table_a", ["dbo.tr_a_1", "dbo.tr_a_2"]],
        ["dbo.table_b", ["dbo.tr_b_1", "dbo.tr_b_2"]],
      ]),
      parentPositions: {
        "dbo.table_a": { x: 0, y: 100 },
        "dbo.table_b": { x: 0, y: 420 },
      },
      getParentWidth: () => 300,
      getParentHeight: () => 220,
      getChildWidth: (id) => widths.get(id) ?? 180,
      getChildHeight: (id) => heights.get(id) ?? 140,
      baseGapX: 48,
      stackGapY: 24,
      minLaneGapX: 72,
      minBandGapX: 140,
    });

    expect(layout.positions["dbo.tr_a_1"].x).toBe(layout.positions["dbo.tr_b_1"].x);
    assertNoOverlap(layout.positions, widths, heights);
  });

  it("pushes later bands right when trigger sidecar needs space", () => {
    const layout = layoutRightAnchoredChildrenByBands({
      orderedBandIds: ["band0", "band1"],
      parentIdsByBand: new Map([
        ["band0", ["dbo.table_a"]],
        ["band1", ["dbo.table_b"]],
      ]),
      childIdsByParent: new Map([["dbo.table_a", ["dbo.tr_a_1", "dbo.tr_a_2"]]]),
      parentPositions: {
        "dbo.table_a": { x: 0, y: 80 },
        "dbo.table_b": { x: 360, y: 80 },
      },
      getParentWidth: () => 300,
      getParentHeight: () => 200,
      getChildWidth: () => 180,
      getChildHeight: () => 150,
      baseGapX: 48,
      stackGapY: 24,
      minLaneGapX: 72,
      minBandGapX: 140,
    });

    expect(layout.bandShiftById.get("band0")).toBe(0);
    expect((layout.bandShiftById.get("band1") ?? 0)).toBeGreaterThan(0);
  });

  it("does not push trigger to global far-right when overlap is in later band", () => {
    const layout = layoutRightAnchoredChildrenByBands({
      orderedBandIds: ["band0", "band1"],
      parentIdsByBand: new Map([
        ["band0", ["dbo.table_a"]],
        ["band1", ["dbo.table_b"]],
      ]),
      childIdsByParent: new Map([["dbo.table_a", ["dbo.tr_a_1"]]]),
      parentPositions: {
        "dbo.table_a": { x: 0, y: 120 },
        "dbo.table_b": { x: 360, y: 120 },
      },
      getParentWidth: () => 300,
      getParentHeight: () => 200,
      getChildWidth: () => 180,
      getChildHeight: () => 150,
      baseGapX: 48,
      stackGapY: 24,
      minLaneGapX: 72,
      minBandGapX: 140,
    });

    expect(layout.positions["dbo.tr_a_1"].x).toBe(348);
    expect((layout.bandShiftById.get("band1") ?? 0)).toBeGreaterThan(0);
  });

  it("returns orphan triggers for fallback bottom placement in band reflow", () => {
    const layout = layoutRightAnchoredChildrenByBands({
      orderedBandIds: ["band0"],
      parentIdsByBand: new Map([["band0", ["dbo.table_a"]]]),
      childIdsByParent: new Map([
        ["dbo.table_a", ["dbo.tr_present"]],
        ["dbo.table_missing", ["dbo.tr_orphan"]],
      ]),
      parentPositions: {
        "dbo.table_a": { x: 0, y: 120 },
      },
      getParentWidth: () => 300,
      getParentHeight: () => 200,
      getChildWidth: () => 180,
      getChildHeight: () => 150,
      baseGapX: 48,
      stackGapY: 24,
      minLaneGapX: 72,
      minBandGapX: 140,
    });

    expect(layout.positions["dbo.tr_present"]).toBeDefined();
    expect(layout.positions["dbo.tr_orphan"]).toBeUndefined();
    expect(layout.unplacedChildIds).toEqual(["dbo.tr_orphan"]);
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
