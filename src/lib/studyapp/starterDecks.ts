/**
 * Starter decks a student can add with one tap. Written by Plumi, board-neutral, and limited to facts that
 * are the same on every GCSE and A-level specification; a student should still check a card against their
 * own spec and edit it (every card is editable once it is theirs). Nothing here is added until the
 * student asks: an empty Desk is honest, a Desk full of someone else's cards is not.
 *
 * Reviewed by: nobody yet. The chemistry and biology wording in particular wants a teacher's eye before launch.
 */
export interface StarterDeck { id: string; title: string; subject: "Chemistry" | "Physics" | "Maths" | "Biology"; level: string; cards: readonly (readonly [string, string])[] }

export const STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: "chem-carbonyls", title: "Carbonyls", subject: "Chemistry", level: "A-level",
    cards: [
      ["Why is the C=O bond polar?", "O is more electronegative than C, so the shared electrons sit nearer O: δ− on O, δ+ on C."],
      ["What is the functional group of an aldehyde?", "–CHO: a carbonyl group at the end of a carbon chain, with a hydrogen on the carbonyl carbon."],
      ["What is the functional group of a ketone?", "A C=O in the middle of a carbon chain, bonded to two carbon atoms (R–CO–R′)."],
      ["What does an aldehyde oxidise to with acidified potassium dichromate(VI)?", "A carboxylic acid. Ketones do not oxidise."],
      ["Which reagent reduces aldehydes and ketones to alcohols?", "NaBH₄, which supplies hydride ions (H⁻) as the reducing agent."],
      ["Name the mechanism when HCN reacts with an aldehyde.", "Nucleophilic addition. CN⁻ attacks the δ+ carbon, then the intermediate is protonated to give a hydroxynitrile."],
      ["What is seen when an aldehyde is warmed with Tollens’ reagent?", "A silver mirror forms: the aldehyde is oxidised and Ag⁺ is reduced to Ag. A ketone gives no change."],
      ["What is seen when an aldehyde is warmed with Fehling’s solution?", "The blue solution gives a brick-red precipitate of copper(I) oxide. A ketone gives no change."],
      ["How do you test for a carbonyl group (aldehyde or ketone)?", "Add 2,4-dinitrophenylhydrazine: an orange precipitate forms."],
      ["Why does CN⁻ adding to an unsymmetrical ketone give a racemic mixture?", "The C=O is planar, so the nucleophile attacks from either side with equal probability, giving equal amounts of both enantiomers."],
    ],
  },
  {
    id: "phys-mechanics", title: "Mechanics", subject: "Physics", level: "GCSE and A-level",
    cards: [
      ["State Newton’s second law.", "Resultant force = mass × acceleration (F = ma). More generally, force is the rate of change of momentum."],
      ["What is the difference between speed and velocity?", "Speed is a scalar (distance per unit time). Velocity is a vector (displacement per unit time), so it has a direction."],
      ["Write the equation v = u + at in words.", "Final velocity = initial velocity + acceleration × time, for constant acceleration."],
      ["Write s = ut + ½at² in words.", "Displacement = initial velocity × time + ½ × acceleration × time², for constant acceleration."],
      ["What is the equation for kinetic energy?", "Eₖ = ½mv², with mass in kg and speed in m/s giving joules."],
      ["What is the change in gravitational potential energy near the Earth’s surface?", "ΔE = mgΔh: mass × gravitational field strength × change in height."],
      ["What is momentum, and what is conserved in a collision?", "p = mv. In a closed system the total momentum before a collision equals the total momentum after it."],
      ["What is work done?", "Force × distance moved in the direction of the force, measured in joules."],
      ["What is power?", "The rate of doing work: power = work done ÷ time, in watts."],
      ["State Hooke’s law.", "The extension of a spring is proportional to the force applied (F = kx), up to the limit of proportionality."],
    ],
  },
  {
    id: "maths-differentiation", title: "Differentiation", subject: "Maths", level: "A-level",
    cards: [
      ["Differentiate xⁿ.", "nxⁿ⁻¹"],
      ["Differentiate eˣ.", "eˣ"],
      ["Differentiate ln x.", "1/x"],
      ["Differentiate sin x and cos x (x in radians).", "d/dx(sin x) = cos x and d/dx(cos x) = −sin x"],
      ["Differentiate tan x (x in radians).", "sec²x"],
      ["Differentiate eᵏˣ.", "keᵏˣ"],
      ["State the chain rule.", "dy/dx = dy/du × du/dx"],
      ["State the product rule.", "If y = uv, then dy/dx = u dv/dx + v du/dx."],
      ["State the quotient rule.", "If y = u/v, then dy/dx = (v du/dx − u dv/dx) / v²."],
      ["How do you find and classify a stationary point?", "Solve dy/dx = 0, then use d²y/dx² (or the sign of dy/dx either side) to decide if it is a maximum, a minimum or a point of inflection."],
    ],
  },
  {
    id: "bio-cells", title: "Cells and transport", subject: "Biology", level: "GCSE and A-level",
    cards: [
      ["What is the function of the mitochondria?", "They are the site of aerobic respiration, making ATP."],
      ["What is the function of ribosomes?", "They are the site of protein synthesis."],
      ["Define diffusion.", "The net movement of particles from a region of higher concentration to a region of lower concentration, down a concentration gradient. It is passive."],
      ["Define osmosis.", "The net movement of water from a region of higher water potential to a region of lower water potential, across a partially permeable membrane."],
      ["What is active transport?", "Movement of substances against a concentration gradient, using energy from ATP and carrier proteins."],
      ["What does the cell surface membrane do?", "It controls what enters and leaves the cell. It is partially permeable."],
      ["Why is an enzyme specific to its substrate?", "Its active site has a shape complementary to the substrate, so only that substrate fits and forms an enzyme–substrate complex."],
      ["How do enzymes speed up a reaction?", "They lower the activation energy of the reaction."],
      ["Which bases pair in DNA?", "Adenine with thymine, and cytosine with guanine."],
      ["Write the word equation for photosynthesis.", "Carbon dioxide + water → glucose + oxygen, using light energy absorbed by chlorophyll."],
    ],
  },
];
