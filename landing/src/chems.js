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
