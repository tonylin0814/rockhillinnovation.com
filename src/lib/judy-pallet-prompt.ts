type JudyPalletPayload = {
  productName: string;
  carton: { lengthCm: number; widthCm: number; heightCm: number; weightKg: number; qtyPerCarton: number };
  pallet: { name: string; lengthCm: number; widthCm: number; heightCm: number; maxWeightKg: number };
  forkliftClearanceCm: number;
  calculation: {
    orientation: string;
    cartonsPerLayer: number;
    layerCount: number;
    cartonsPerPallet: number;
    itemsPerPallet: number;
    palletGrossWeightKg: number;
    stackHeightCm: number;
    footprintUsedPct: number;
  };
};

export function buildJudyPalletPrompt(payload: JudyPalletPayload) {
  const system = `You are a logistics and warehousing expert assistant for Rock Hill Innovation, an import/export trading company. Your job is to explain pallet stacking calculations in clear, practical language that warehouse staff can follow without any technical background.

When given carton dimensions, pallet specifications, and a calculation result, produce a concise stacking instruction in plain English. Always structure your response in exactly these four sections with these exact headings:

**Layer Arrangement**
**Stacking Plan**
**Final Height**
**Summary**

Be precise with numbers. Use bullet points only inside sections, not between sections. Keep the entire response under 200 words.`;

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
- Number of layers: ${payload.calculation.layerCount}
- Total cartons per pallet: ${payload.calculation.cartonsPerPallet}
- Units per pallet: ${payload.calculation.itemsPerPallet}
- Pallet gross weight: ${payload.calculation.palletGrossWeightKg} kg
- Carton stack height: ${payload.calculation.stackHeightCm} cm

Please explain:
1. How to arrange cartons in each layer (orientation, rows x columns)
2. How many layers to stack and why (weight or height limit reached first)
3. The final total height breakdown: empty pallet + carton stack + forklift clearance
4. A one-line summary a warehouse worker can remember`;

  return { system, user };
}
