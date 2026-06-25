type JudyPalletPayload = {
  productName: string;
  carton: { lengthCm: number; widthCm: number; heightCm: number; weightKg: number; qtyPerCarton: number };
  pallet: { name: string; lengthCm: number; widthCm: number; heightCm: number; maxWeightKg: number };
  forkliftClearanceCm: number;
  calculation: {
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

When given carton dimensions, pallet specifications, and a calculation result, produce TWO complete pallet configurations - one for standard containers (20 ft / 40 ft, 239 cm internal height) and one for high-cube containers (40 ft HQ, 269.8 cm internal height). The layer count may differ between the two since HQ containers allow more stacking height.

Always structure your response with exactly these six sections in this order:

**Layer Arrangement**
**Standard Container (20 ft / 40 ft) - Stacking Plan**
**Standard Container (20 ft / 40 ft) - Final Height**
**40 ft HQ Container - Stacking Plan**
**40 ft HQ Container - Final Height**
**Summary**

Be precise with numbers. Use bullet points only inside sections, not between sections. Keep the entire response under 300 words.`;

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
1. How to arrange cartons in each layer. Do not invent row or column counts if they are not explicit.
2. Use ONLY the standard container numbers above for the standard plan. Do not recalculate them.
3. Use ONLY the 40 ft HQ numbers above for the HQ plan. Do not recalculate them.
4. Never say PASS when total height is greater than the container height.
5. A one-line summary comparing both configurations (for example: "Standard: X cartons/pallet; HQ: Y cartons/pallet")`;

  return { system, user };
}
