# Data model (draft — schema v1)

All lengths in **millimetres**. Coordinate origin for a layout is the
**top-left inner corner** of the container cavity, looking straight down:
`x` grows right, `y` grows "down" the page (toward the user), `z` grows up out
of the floor.

## Container

```jsonc
{
  "id": "lp-organizer",              // stable slug
  "name": "PACKOUT Low-Profile Organizer",
  "modelNumbers": ["48-22-8436"],    // manufacturer SKUs, for reference
  "family": "organizer",             // organizer | toolbox | drawer | crate | bin
  "internal": {                      // usable cavity that an insert can occupy
    "x_mm": null,
    "y_mm": null,
    "z_mm": null                     // floor to underside of closed lid
  },
  "features": {
    "hasRemovableBins": true,        // organizers ship with dividers/bins
    "floorProfile": "flat",          // flat | ribbed | recessed
    "cornerRadius_mm": null
  },
  "verified": false,                 // true only after physical measurement
  "source": "",                      // where dims came from (measured / spec sheet URL)
  "notes": "Placeholder. Measure before using for export."
}
```

## Tool

```jsonc
{
  "id": "m18-fuel-drill-2904",
  "name": "M18 FUEL 1/2\" Drill/Driver",
  "brand": "Milwaukee",
  "modelNumbers": ["2904-20"],
  "category": "drill",              // drill | driver | impact | saw | hand-tool | meter | accessory | ...
  "bbox_mm": { "l": null, "w": null, "h": null },  // overall bounding box
  "outline": null,                 // optional [[x,y],...] polygon (mm) for a tighter pocket, in top-down view
  "pocket": {
    "style": "bbox",               // bbox | outline | cylinder
    "clearance_mm": 1.0,           // added around the tool on all sides
    "depth_mm": null,              // null => auto (fraction of tool height)
    "fingerScoop": true
  },
  "verified": false,
  "source": "",
  "notes": ""
}
```

## Project file

```jsonc
{
  "schema": 1,
  "name": "My LP Organizer layout",
  "containerId": "lp-organizer",
  "units": "mm",
  "global": {
    "baseThickness_mm": 3,
    "edgeClearance_mm": 0.5,        // gap between insert and cavity wall
    "minWall_mm": 1.6,             // between pockets / to insert edge
    "defaultClearance_mm": 1.0
  },
  "placements": [
    {
      "id": "p1",
      "toolId": "m18-fuel-drill-2904",
      "x_mm": 20, "y_mm": 20,      // position of the tool's bbox top-left
      "rot_deg": 0,               // CCW about the pocket centre
      "overrides": { "clearance_mm": 1.5, "depth_mm": 40, "fingerScoop": true }
    }
  ]
}
```

## Validation rules (layout engine)

| Rule | Check |
|------|-------|
| in-bounds | every pocket (bbox + clearance, after rotation) lies within `internal.x/y` minus `edgeClearance` |
| no-overlap | no two pockets' expanded rectangles/polygons intersect |
| min-wall | gap between any two pockets and between a pocket and the insert edge >= `minWall_mm` |
| height | `baseThickness + max(pocket depth) <= internal.z_mm - lidClearance` |
| pocket-depth | `depth_mm <= toolHeight` (warn) and `>= 3` (floor stays printable) |

## Library sharing format

CSV columns for tool import/export:
`id,name,brand,modelNumbers,category,l_mm,w_mm,h_mm,clearance_mm,verified,source`
