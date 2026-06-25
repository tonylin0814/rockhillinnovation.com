const STD_CONTAINER_HEIGHT_CM = 239;
const HQ_CONTAINER_HEIGHT_CM = 269.8;

type JudyPalletPayload = {
  productName: string;
  carton: { lengthCm: number; widthCm: number; heightCm: number; weightKg: number; qtyPerCarton: number };
  pallet: { name: string; lengthCm: number; widthCm: number; heightCm: number; maxWeightKg: number };
  forkliftClearanceCm: number;
};

export function buildJudyPalletPrompt(payload: JudyPalletPayload) {
  const { carton, pallet, forkliftClearanceCm } = payload;

  // Pre-compute available stack heights so Judy doesn't have to do subtraction
  const stdAvailableHeightCm = STD_CONTAINER_HEIGHT_CM - pallet.heightCm - forkliftClearanceCm;
  const hqAvailableHeightCm = HQ_CONTAINER_HEIGHT_CM - pallet.heightCm - forkliftClearanceCm;

  // Pre-compute max layers by height for each container (Judy still needs to apply weight constraint)
  const stdMaxLayersByHeight = Math.floor(stdAvailableHeightCm / carton.heightCm);
  const hqMaxLayersByHeight = Math.floor(hqAvailableHeightCm / carton.heightCm);

  const system = `You are Judy, the logistics assistant for Rock Hill Innovation.

Calculate pallet loading from the supplied dimensions. Return JSON only. Do not include markdown, no code fences.

Step-by-step rules — follow exactly:

STEP 1 — Choose orientation (same for both containers):
- Option A "L x W base": cartonsAlongLength = floor(${pallet.lengthCm} / carton_length), cartonsAlongWidth = floor(${pallet.widthCm} / carton_width)
- Option B "W x L base": cartonsAlongLength = floor(${pallet.lengthCm} / carton_width), cartonsAlongWidth = floor(${pallet.widthCm} / carton_length)
- cartonsPerLayer = cartonsAlongLength × cartonsAlongWidth
- Pick the option with the higher cartonsPerLayer. If equal, pick Option A.

STEP 2 — Standard container (20'/40', internal height ${STD_CONTAINER_HEIGHT_CM} cm):
- Available stack height already computed: ${stdAvailableHeightCm} cm
- maxLayersByHeight = ${stdMaxLayersByHeight} (pre-computed: floor(${stdAvailableHeightCm} / carton_height))
- maxLayersByWeight = floor(${pallet.maxWeightKg} / (cartonsPerLayer × ${carton.weightKg}))
- layerCount = min(maxLayersByHeight, maxLayersByWeight)
- cartonsPerPallet = cartonsPerLayer × layerCount
- itemsPerPallet = cartonsPerPallet × ${carton.qtyPerCarton}
- palletGrossWeightKg = cartonsPerPallet × ${carton.weightKg}
- stackHeightCm = layerCount × ${carton.heightCm}
- totalHeightCm = ${pallet.heightCm} + stackHeightCm + ${forkliftClearanceCm}
- fits = totalHeightCm <= ${STD_CONTAINER_HEIGHT_CM}

STEP 3 — 40'HQ container (internal height ${HQ_CONTAINER_HEIGHT_CM} cm):
- Available stack height already computed: ${hqAvailableHeightCm} cm
- maxLayersByHeight = ${hqMaxLayersByHeight} (pre-computed: floor(${hqAvailableHeightCm} / carton_height))
- maxLayersByWeight = floor(${pallet.maxWeightKg} / (cartonsPerLayer × ${carton.weightKg}))
- layerCount = min(maxLayersByHeight, maxLayersByWeight)
- cartonsPerPallet = cartonsPerLayer × layerCount
- itemsPerPallet = cartonsPerPallet × ${carton.qtyPerCarton}
- palletGrossWeightKg = cartonsPerPallet × ${carton.weightKg}
- stackHeightCm = layerCount × ${carton.heightCm}
- totalHeightCm = ${pallet.heightCm} + stackHeightCm + ${forkliftClearanceCm}
- fits = totalHeightCm <= ${HQ_CONTAINER_HEIGHT_CM}

Return exactly this JSON shape with no other text:
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

  const user = `Calculate pallet loading for: ${payload.productName}

Carton: ${carton.lengthCm} cm (L) × ${carton.widthCm} cm (W) × ${carton.heightCm} cm (H), ${carton.weightKg} kg, ${carton.qtyPerCarton} units/carton
Pallet: ${pallet.name} — ${pallet.lengthCm} cm (L) × ${pallet.widthCm} cm (W), empty height ${pallet.heightCm} cm, max load ${pallet.maxWeightKg} kg
Forklift clearance: ${forkliftClearanceCm} cm

Pre-computed constraints:
- Standard container available stack height: ${stdAvailableHeightCm} cm → max ${stdMaxLayersByHeight} layers by height
- 40'HQ container available stack height: ${hqAvailableHeightCm} cm → max ${hqMaxLayersByHeight} layers by height
- Weight limit applies to both: floor(${pallet.maxWeightKg} / (cartonsPerLayer × ${carton.weightKg})) layers

Follow the step-by-step rules in the system prompt and return the JSON.`;

  return { system, user };
}
