type JudyPalletPayload = {
  productName: string;
  carton: { lengthCm: number; widthCm: number; heightCm: number; weightKg: number; qtyPerCarton: number };
  pallet: { name: string; lengthCm: number; widthCm: number; heightCm: number; maxWeightKg: number };
  forkliftClearanceCm: number;
};

export function buildJudyPalletPrompt(payload: JudyPalletPayload) {
  const system = `You are Judy, the logistics assistant for Rock Hill Innovation.

Calculate pallet loading from the supplied dimensions. Return JSON only. Do not include markdown.

Rules:
- Use only normal upright carton stacking. The carton height is always the vertical stacking height.
- Choose between two floor orientations only: "L x W base" or "W x L base".
- cartonsAlongLength = floor(pallet length / carton footprint length).
- cartonsAlongWidth = floor(pallet width / carton footprint width).
- cartonsPerLayer = cartonsAlongLength * cartonsAlongWidth.
- Available carton stack height = container internal height - empty pallet height - forklift clearance.
- layerCount = min(floor(available carton stack height / carton height), floor(pallet max load weight / (cartonsPerLayer * carton weight))).
- cartonsPerPallet = cartonsPerLayer * layerCount.
- itemsPerPallet = cartonsPerPallet * units per carton.
- stackHeightCm = layerCount * carton height.
- totalHeightCm = empty pallet height + stackHeightCm + forklift clearance.
- fits is true only when totalHeightCm <= container internal height.
- Standard container is 239 cm internal height.
- 40HQ is 269.8 cm internal height.
- Prefer the orientation with the most cartons per layer. If tied, prefer the better footprint use.

Return exactly this JSON shape:
{
  "layerSetup": {
    "orientation": "L x W base",
    "cartonsAlongLength": 0,
    "cartonsAlongWidth": 0,
    "cartonsPerLayer": 0
  },
  "standardPlan": {
    "layerCount": 0,
    "cartonsPerPallet": 0,
    "itemsPerPallet": 0,
    "palletGrossWeightKg": 0,
    "stackHeightCm": 0,
    "totalHeightCm": 0,
    "fits": true
  },
  "hqPlan": {
    "layerCount": 0,
    "cartonsPerPallet": 0,
    "itemsPerPallet": 0,
    "palletGrossWeightKg": 0,
    "stackHeightCm": 0,
    "totalHeightCm": 0,
    "fits": true
  },
  "explanation": "short plain-English summary"
}`;

  const user = `Calculate pallet loading.

Product: ${payload.productName}
Carton length: ${payload.carton.lengthCm} cm
Carton width: ${payload.carton.widthCm} cm
Carton height: ${payload.carton.heightCm} cm
Carton gross weight: ${payload.carton.weightKg} kg
Units per carton: ${payload.carton.qtyPerCarton}

Pallet name: ${payload.pallet.name}
Pallet length: ${payload.pallet.lengthCm} cm
Pallet width: ${payload.pallet.widthCm} cm
Pallet empty height: ${payload.pallet.heightCm} cm
Pallet max load weight: ${payload.pallet.maxWeightKg} kg
Forklift clearance: ${payload.forkliftClearanceCm} cm

Explanation text should be simple:
Layer Setup: X x Y, Z cartons per layer.
20 / 40GP: N layers, total height H cm.
40HQ: N layers, total height H cm.
Summary: one sentence.`;

  return { system, user };
}
