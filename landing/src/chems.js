// What's in the cloud on the opening screen. Every one has been measured in e-cigarette aerosol in published
// studies (NASEM 2018 review; metals: Olmedo et al. 2018; diacetyl: Allen et al. 2016; benzene: Pankow et al. 2017).
// Amounts vary a lot by device, power and liquid; the page says so under the headline.
// `at`: where the label floats among the clouds (world units, the opening shot looks at y ≈ 10.4).
export const CHEMS = [
  { f: "Pb", n: "Lead", at: [-5.6, 12.9, 0.6] },
  { f: "CH2O", n: "Formaldehyde", at: [4.9, 13.3, -0.4] },
  { f: "C10H14N2", n: "Nicotine", at: [-6.3, 7.6, 1.2] },
  { f: "Ni", n: "Nickel", at: [6.4, 8.4, 0.2] },
  { f: "C3H4O", n: "Acrolein", at: [-2.2, 14.0, -1.2] },
  { f: "C4H6O2", n: "Diacetyl", at: [2.6, 7.1, 1.6] },
  { f: "Cr", n: "Chromium", at: [-3.0, 7.3, 0.4] },
  { f: "C6H6", n: "Benzene", at: [5.9, 11.6, -1.4] },
  { f: "C3H8O2", n: "Propylene glycol", at: [-7.6, 10.4, -0.8] },
];

// "C10H14N2" -> ["C", <sub>10</sub>, "H", ...] (Sora has no subscript digits)
export const formula = f => f.split(/(\d+)/).filter(Boolean).map((p, i) => (/^\d+$/.test(p) ? { sub: p, k: i } : { t: p, k: i }));

// After the poison has filled the lungs, these five appear as markers on the dead tissue; hover / tap one to read it.
// IUPAC: nicotine and acrolein are their preferred IUPAC names; formaldehyde's PIN is "formaldehyde", so we show the
// systematic name (methanal); lead and nickel are elements, whose IUPAC names are just the element names.
export const FINDINGS = [
  { f: "C10H14N2", n: "Nicotine", iupac: "3-[(2S)-1-methylpyrrolidin-2-yl]pyridine", line: "Too toxic for crops. Not too toxic for your lungs." },
  { f: "CH2O", n: "Formaldehyde", iupac: "methanal", line: "Used to preserve the dead. Inhaled by the living." },
  { f: "C3H4O", n: "Acrolein", iupac: "prop-2-enal", line: "Once a weapon of war. Now a flavor of the month." },
  { f: "Pb", n: "Lead", iupac: "lead · element 82", line: "We took it out of paint. We took it out of gas. Now it’s back, one puff at a time." },
  { f: "Ni", n: "Nickel", iupac: "nickel · element 28", line: "Workers wear masks around it. Vapers breathe it in." },
];
