type JudyPalletPayload = {
  productName: string;
  carton: { lengthCm: number; widthCm: number; heightCm: number; weightKg: number; qtyPerCarton: number };
  pallet: { name: string; lengthCm: number; widthCm: number; heightCm: number; maxWeightKg: number };
  forkliftClearanceCm: number;
  calculation: {
    cartonsAlongLength: number;
    cartonsAlongWidth: number;
    orientation: string;
    cartonsPerLayer: number;
    footprintUsedPct: number;
  };
  standardPlan: {
    containerHeightCm: number;
    availableStackHeightCm: number;
    layerCount: number;
    cartonsPerPallet: number;
    itemsPerPallet: number;
    palletGrossWeightKg: number;
    stackHeightCm: number;
    totalHeightCm: number;
    fits: boolean;
  };
  hqPlan: {
    containerHeightCm: number;
    availableStackHeightCm: number;
    layerCount: number;
    cartonsPerPallet: number;
    itemsPerPallet: number;
    palletGrossWeightKg: number;
    stackHeightCm: number;
    totalHeightCm: number;
    fits: boolean;
  };
};

export function buildJudyPalletPrompt(payload: JudyPalletPayload) {
  const system = `You are a logistics and warehousing expert assistant for Rock Hill Innovation, an import/export trading company. Your job is to explain pallet stacking calculations in clear, practical language that warehouse staff can follow without any technical background.

When given carton dimensions, pallet specifications, and calculation results, answer only the practical warehouse questions. Do not recalculate. Use only the numbers supplied.

Always structure your response with exactly these four sections in this order:

**Layer Setup**
**20 / 40GP**
**40HQ**
**Summary**

Keep the entire response under 120 words. If total height is greater than container height, say it does not fit.`;

  const user = `Here is a pallet stacking calculation. Please explain the stacking instructions.

Product: ${payload.productName}
Carton dimensions: ${payload.carton.lengthCm} cm (L) x ${payload.carton.widthCm} cm (W) x ${payload.carton.heightCm} cm (H)
Carton gross weight: ${payload.carton.weightKg} kg
Units per carton: ${payload.carton.qtyPerCarton}

Pallet: ${payload.pallet.name}
Pallet dimensions: ${payload.pallet.lengthCm} cm (L) x ${payload.pallet.widthCm} cm (W) x ${payload.pallet.heightCm} cm (H, empty pallet)
Pallet max load weight: ${payload.pallet.maxWeightKg} kg
Forklift clearance required: ${payload.forkliftClearanceCm} cm

Calculation result:
- Best orientation: ${payload.calculation.orientation}
- Layer setup: ${payload.calculation.cartonsAlongLength} x ${payload.calculation.cartonsAlongWidth}
- Cartons per layer: ${payload.calculation.cartonsPerLayer}
- Pallet footprint used: ${payload.calculation.footprintUsedPct}%

Standard container result (20 ft / 40 ft, ${payload.standardPlan.containerHeightCm} cm internal height):
- Available carton stack height: ${payload.standardPlan.availableStackHeightCm} cm
- Number of layers: ${payload.standardPlan.layerCount}
- Total cartons per pallet: ${payload.standardPlan.cartonsPerPallet}
- Units per pallet: ${payload.standardPlan.itemsPerPallet}
- Pallet gross weight: ${payload.standardPlan.palletGrossWeightKg} kg
- Carton stack height: ${payload.standardPlan.stackHeightCm} cm
- Final total height: ${payload.standardPlan.totalHeightCm} cm
- Fit result: ${payload.standardPlan.fits ? "PASS" : "FAIL"}

40 ft HQ container result (${payload.hqPlan.containerHeightCm} cm internal height):
- Available carton stack height: ${payload.hqPlan.availableStackHeightCm} cm
- Number of layers: ${payload.hqPlan.layerCount}
- Total cartons per pallet: ${payload.hqPlan.cartonsPerPallet}
- Units per pallet: ${payload.hqPlan.itemsPerPallet}
- Pallet gross weight: ${payload.hqPlan.palletGrossWeightKg} kg
- Carton stack height: ${payload.hqPlan.stackHeightCm} cm
- Final total height: ${payload.hqPlan.totalHeightCm} cm
- Fit result: ${payload.hqPlan.fits ? "PASS" : "FAIL"}

Please explain:
1. Layer Setup: show only the setup like "${payload.calculation.cartonsAlongLength} x ${payload.calculation.cartonsAlongWidth}" and cartons per layer.
2. 20 / 40GP: show layers and total height including pallet and forklift clearance.
3. 40HQ: show layers and total height including pallet and forklift clearance.
4. Summary: one short sentence comparing both configurations.`;

  return { system, user };
}
