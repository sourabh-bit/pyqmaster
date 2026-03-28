import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSecretTrigger } from "@/hooks/use-secret-trigger";
import { ChevronLeft, ChevronRight, Menu, Search } from "lucide-react";

interface PYQViewProps {
  onUnlock: () => void;
}

type SubjectKey = "maths" | "physics" | "chemistry";

interface Question {
  id: number;
  chapter: string;
  text: string;
  options: [string, string, string, string];
}

interface SectionConfig {
  key: SubjectKey;
  shortLabel: string;
  title: string;
  subtitle: string;
  chapters: string[];
  questions: Question[];
}

type QuestionSeed = Omit<Question, "id">;

const subjectOrder: SubjectKey[] = ["maths", "physics", "chemistry"];

const subjectStyles: Record<
  SubjectKey,
  {
    border: string;
    badge: string;
    chip: string;
    option: string;
    navActive: string;
    summary: string;
    summaryText: string;
  }
> = {
  maths: {
    border: "border-blue-200",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    chip: "bg-blue-100 text-blue-700",
    option: "hover:border-blue-200 hover:bg-blue-50",
    navActive: "border-blue-600 bg-blue-600 text-white shadow-sm",
    summary: "from-blue-50 to-white",
    summaryText: "text-blue-700",
  },
  physics: {
    border: "border-emerald-200",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    chip: "bg-emerald-100 text-emerald-700",
    option: "hover:border-emerald-200 hover:bg-emerald-50",
    navActive: "border-emerald-600 bg-emerald-600 text-white shadow-sm",
    summary: "from-emerald-50 to-white",
    summaryText: "text-emerald-700",
  },
  chemistry: {
    border: "border-amber-200",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    chip: "bg-amber-100 text-amber-700",
    option: "hover:border-amber-200 hover:bg-amber-50",
    navActive: "border-amber-600 bg-amber-600 text-white shadow-sm",
    summary: "from-amber-50 to-white",
    summaryText: "text-amber-700",
  },
};

function buildQuestions(baseId: number, seeds: QuestionSeed[]): Question[] {
  return seeds.map((seed, index) => ({
    id: baseId + index + 1,
    ...seed,
  }));
}

const mathsQuestions = buildQuestions(12000, [
  {
    chapter: "Differentiation",
    text: "The derivative of sin x with respect to x is:",
    options: ["cos x", "-cos x", "sin x", "-sin x"],
  },
  {
    chapter: "Differentiation",
    text: "If y = x^3 + 2x, then dy/dx at x = 1 is:",
    options: ["5", "3", "4", "1"],
  },
  {
    chapter: "Definite Integrals",
    text: "The value of integral from 0 to 1 of 2x dx is:",
    options: ["1", "0", "2", "1/2"],
  },
  {
    chapter: "Integrals",
    text: "An antiderivative of sec^2 x is:",
    options: ["tan x + C", "cot x + C", "sec x + C", "sin x + C"],
  },
  {
    chapter: "Differential Equations",
    text: "The general solution of dy/dx = 4y is:",
    options: ["y = Ce^(4x)", "y = 4Ce^x", "y = C + 4x", "y = Ce^x"],
  },
  {
    chapter: "Determinants",
    text: "The determinant of the matrix [ [1, 2], [3, 4] ] is:",
    options: ["-2", "2", "10", "0"],
  },
  {
    chapter: "Matrices",
    text: "The inverse of the matrix [ [1, 0], [0, 2] ] is:",
    options: [
      "[ [1, 0], [0, 1/2] ]",
      "[ [2, 0], [0, 1] ]",
      "[ [1/2, 0], [0, 1] ]",
      "[ [1, 0], [0, 2] ]",
    ],
  },
  {
    chapter: "Matrices",
    text: "If A = [ [2, 0], [0, 2] ], then A^-1 equals:",
    options: ["(1/2)I", "2I", "I", "0"],
  },
  {
    chapter: "Vector Algebra",
    text: "The magnitude of i + j + 2k is:",
    options: ["sqrt(6)", "2", "3", "sqrt(5)"],
  },
  {
    chapter: "Vector Algebra",
    text: "The angle between unit vectors i and j is:",
    options: ["90 degrees", "45 degrees", "0 degrees", "180 degrees"],
  },
  {
    chapter: "Three Dimensional Geometry",
    text: "A point on the z-axis satisfying x + y + z = 6 is:",
    options: ["(0, 0, 6)", "(6, 0, 0)", "(0, 6, 0)", "(1, 1, 4)"],
  },
  {
    chapter: "Three Dimensional Geometry",
    text: "The distance between points (1, 2, 3) and (1, 2, 8) is:",
    options: ["5", "3", "8", "sqrt(25) / 2"],
  },
  {
    chapter: "Probability",
    text: "A bag has 5 red and 3 blue balls. The probability of drawing a red ball is:",
    options: ["5/8", "3/8", "1/2", "2/5"],
  },
  {
    chapter: "Probability",
    text: "The probability of getting at least one head in two coin tosses is:",
    options: ["3/4", "1/4", "1/2", "2/3"],
  },
  {
    chapter: "Continuity",
    text: "The limit of (x^2 - 1) / (x - 1) as x approaches 1 is:",
    options: ["2", "1", "0", "Does not exist"],
  },
  {
    chapter: "Application of Derivatives",
    text: "The function y = -x^2 + 4x + 1 attains its maximum at x =",
    options: ["2", "1", "4", "-2"],
  },
  {
    chapter: "Application of Derivatives",
    text: "The slope of the tangent to y = x^2 at x = 3 is:",
    options: ["6", "3", "9", "2"],
  },
  {
    chapter: "Integrals",
    text: "The integral of 1/x dx is:",
    options: ["log|x| + C", "1/(x^2) + C", "x + C", "e^x + C"],
  },
  {
    chapter: "Definite Integrals",
    text: "The value of integral from 0 to pi of sin x dx is:",
    options: ["2", "0", "1", "pi"],
  },
  {
    chapter: "Matrices",
    text: "The solution of x + y = 5 and x - y = 1 is:",
    options: ["x = 3, y = 2", "x = 2, y = 3", "x = 4, y = 1", "x = 1, y = 4"],
  },
  {
    chapter: "Determinants",
    text: "If a determinant has two equal rows, its value is:",
    options: ["0", "1", "-1", "Cannot be decided"],
  },
  {
    chapter: "Linear Programming",
    text: "The value of Z = 3x + 2y at the point (2, 1) is:",
    options: ["8", "7", "6", "9"],
  },
  {
    chapter: "Vector Algebra",
    text: "The magnitude of i x j is:",
    options: ["1", "0", "sqrt(2)", "2"],
  },
  {
    chapter: "Three Dimensional Geometry",
    text: "If l, m and n are direction cosines, then:",
    options: ["l^2 + m^2 + n^2 = 1", "l + m + n = 1", "lm + mn + nl = 1", "lmn = 1"],
  },
  {
    chapter: "Differentiation",
    text: "The derivative of ln x is:",
    options: ["1/x", "x", "ln x", "e^x"],
  },
  {
    chapter: "Integrals",
    text: "The integral of e^x dx is:",
    options: ["e^x + C", "xe^x + C", "ln x + C", "1/e^x + C"],
  },
  {
    chapter: "Differential Equations",
    text: "If dy/dx = 3x^2 and y = 0 at x = 0, then y at x = 1 is:",
    options: ["1", "3", "0", "1/3"],
  },
  {
    chapter: "Definite Integrals",
    text: "The area under y = 2 from x = 0 to x = 3 is:",
    options: ["6", "3", "5", "9"],
  },
  {
    chapter: "Determinants",
    text: "The determinant of the identity matrix of order 2 is:",
    options: ["1", "0", "2", "-1"],
  },
  {
    chapter: "Probability",
    text: "If P(A) = 1/2 and P(B) = 1/3 for independent events, then P(A intersection B) is:",
    options: ["1/6", "5/6", "2/3", "1/5"],
  },
]);

const physicsQuestions = buildQuestions(22000, [
  {
    chapter: "Electrostatics",
    text: "The SI unit of electric field is:",
    options: ["N/C", "J/C", "C/N", "V/m^2"],
  },
  {
    chapter: "Electrostatics",
    text: "The work done in moving a test charge around a closed path in an electrostatic field is:",
    options: ["0", "Positive", "Negative", "Infinite"],
  },
  {
    chapter: "Capacitance",
    text: "The SI unit of capacitance is:",
    options: ["farad", "henry", "ohm", "weber"],
  },
  {
    chapter: "Current Electricity",
    text: "The equivalent resistance of 2 ohm and 3 ohm resistors in series is:",
    options: ["5 ohm", "1.2 ohm", "6 ohm", "2.5 ohm"],
  },
  {
    chapter: "Current Electricity",
    text: "A 12 V battery is connected across a 4 ohm resistor. The current is:",
    options: ["3 A", "4 A", "48 A", "1/3 A"],
  },
  {
    chapter: "Current Electricity",
    text: "The resistance of an ideal voltmeter is:",
    options: ["Very high", "Zero", "Equal to 1 ohm", "Equal to the circuit resistance"],
  },
  {
    chapter: "Moving Charges and Magnetism",
    text: "The direction of magnetic field around a straight current carrying conductor is given by:",
    options: ["Right hand thumb rule", "Left hand rule", "Fleming's left hand rule", "Lenz's law"],
  },
  {
    chapter: "Moving Charges and Magnetism",
    text: "The magnetic force on a charged particle moving parallel to a magnetic field is:",
    options: ["Zero", "Maximum", "Half the maximum value", "Equal to qvB"],
  },
  {
    chapter: "Magnetism",
    text: "The magnetic field inside a long solenoid is approximately:",
    options: ["Uniform", "Zero", "Circular", "Random"],
  },
  {
    chapter: "Electromagnetic Induction",
    text: "Lenz's law is a consequence of the law of:",
    options: ["Conservation of energy", "Conservation of momentum", "Gravitation", "Inertia"],
  },
  {
    chapter: "Electromagnetic Induction",
    text: "An emf is induced in a circuit when there is a change in:",
    options: ["Magnetic flux", "Electric charge", "Resistance", "Mass"],
  },
  {
    chapter: "Alternating Current",
    text: "A transformer works on the principle of:",
    options: ["Mutual induction", "Self induction", "Electrolysis", "Rectification"],
  },
  {
    chapter: "Alternating Current",
    text: "The rms value of an alternating voltage of peak value V0 is:",
    options: ["V0 / sqrt(2)", "sqrt(2)V0", "V0 / 2", "2V0"],
  },
  {
    chapter: "Alternating Current",
    text: "The power factor of a pure resistor in AC circuit is:",
    options: ["1", "0", "1/2", "sqrt(2)"],
  },
  {
    chapter: "Ray Optics",
    text: "The mirror formula is:",
    options: ["1/f = 1/v + 1/u", "f = uv", "1/u = 1/v + 1/f", "u + v = f"],
  },
  {
    chapter: "Ray Optics",
    text: "The SI unit of power of a lens is:",
    options: ["dioptre", "metre", "watt", "candela"],
  },
  {
    chapter: "Ray Optics",
    text: "Total internal reflection occurs when light travels from:",
    options: [
      "A denser medium to a rarer medium with angle greater than critical angle",
      "A rarer medium to a denser medium",
      "Vacuum to air only",
      "A denser medium to a denser medium",
    ],
  },
  {
    chapter: "Wave Optics",
    text: "In Young's double slit experiment, fringe width is given by:",
    options: ["lambda D / d", "lambda d / D", "D / lambda d", "d / lambda D"],
  },
  {
    chapter: "Ray Optics",
    text: "When an object is placed at 2f of a convex lens, the image formed is:",
    options: [
      "Real, inverted and same size at 2f",
      "Virtual and magnified",
      "Real and highly diminished at f",
      "Virtual and erect at infinity",
    ],
  },
  {
    chapter: "Dual Nature of Radiation and Matter",
    text: "The photoelectric effect supports the:",
    options: ["Particle nature of light", "Wave nature of light only", "Magnetic nature of light", "Gravitational nature of light"],
  },
  {
    chapter: "Dual Nature of Radiation and Matter",
    text: "The de Broglie wavelength of a particle is inversely proportional to its:",
    options: ["Momentum", "Mass only", "Speed only", "Charge"],
  },
  {
    chapter: "Nuclei",
    text: "The half life T of a radioactive substance is related to decay constant lambda by:",
    options: ["T = 0.693 / lambda", "T = lambda / 0.693", "T = lambda", "T = 1 / lambda^2"],
  },
  {
    chapter: "Nuclei",
    text: "Isotopes of an element differ in the number of:",
    options: ["Neutrons", "Protons", "Electrons in neutral atoms", "Valence electrons"],
  },
  {
    chapter: "Semiconductor Electronics",
    text: "Doping silicon with a pentavalent impurity produces a:",
    options: ["n-type semiconductor", "p-type semiconductor", "metallic conductor", "superconductor"],
  },
  {
    chapter: "Semiconductor Electronics",
    text: "A diode conducts easily when it is:",
    options: ["Forward biased", "Reverse biased", "Unbiased", "Connected to AC only"],
  },
  {
    chapter: "Semiconductor Electronics",
    text: "The output of a NOT gate for input 1 is:",
    options: ["0", "1", "Both 0 and 1", "Undefined"],
  },
  {
    chapter: "Capacitance",
    text: "The energy stored in a capacitor is:",
    options: ["1/2 CV^2", "CV", "V^2 / C", "2CV^2"],
  },
  {
    chapter: "Current Electricity",
    text: "For a metallic conductor, resistance with increase in temperature generally:",
    options: ["Increases", "Decreases", "Becomes zero", "Remains constant always"],
  },
  {
    chapter: "Wave Optics",
    text: "Optical fibres work on the principle of:",
    options: ["Total internal reflection", "Diffraction", "Polarisation", "Dispersion"],
  },
  {
    chapter: "Moving Charges and Magnetism",
    text: "The magnetic force on a moving charge is maximum when the angle between v and B is:",
    options: ["90 degrees", "0 degrees", "45 degrees", "180 degrees"],
  },
]);

const chemistryQuestions = buildQuestions(32000, [
  {
    chapter: "Solutions",
    text: "The unit of molarity is:",
    options: ["mol L^-1", "mol kg^-1", "g L^-1", "mol^-1 L"],
  },
  {
    chapter: "Solutions",
    text: "For ideal NaCl in water, the van't Hoff factor is approximately:",
    options: ["2", "1", "3", "0.5"],
  },
  {
    chapter: "Electrochemistry",
    text: "Oxidation takes place at the:",
    options: ["Anode", "Cathode", "Salt bridge", "Electrolyte only"],
  },
  {
    chapter: "Electrochemistry",
    text: "Conductivity of a solution generally increases when the number of ions in solution:",
    options: ["Increases", "Decreases", "Becomes zero", "Remains fixed"],
  },
  {
    chapter: "Chemical Kinetics",
    text: "For a first order reaction, the half life is:",
    options: [
      "Independent of initial concentration",
      "Directly proportional to initial concentration",
      "Inversely proportional to initial concentration",
      "Always zero",
    ],
  },
  {
    chapter: "Chemical Kinetics",
    text: "A catalyst increases the rate of reaction by:",
    options: ["Lowering activation energy", "Increasing delta H", "Increasing molecular mass", "Changing the products"],
  },
  {
    chapter: "Surface Chemistry",
    text: "The Tyndall effect is shown by:",
    options: ["Colloids", "True solutions", "Pure solids", "Electrolytes only"],
  },
  {
    chapter: "Surface Chemistry",
    text: "Adsorption is generally:",
    options: ["Exothermic", "Endothermic", "Neutral", "Impossible at low temperature"],
  },
  {
    chapter: "Solid State",
    text: "The packing efficiency of an fcc crystal is:",
    options: ["74%", "52%", "68%", "100%"],
  },
  {
    chapter: "Solutions",
    text: "According to Raoult's law, vapour pressure of an ideal solution depends on the:",
    options: ["Mole fraction of components", "Colour of solute", "Shape of container", "Pressure of atmosphere only"],
  },
  {
    chapter: "Electrochemistry",
    text: "A species with more positive standard reduction potential behaves as a:",
    options: ["Stronger oxidising agent", "Stronger reducing agent", "Weaker oxidising agent", "Catalyst only"],
  },
  {
    chapter: "Electrochemistry",
    text: "During electrolysis of CuSO4 using copper electrodes, the mass of the cathode:",
    options: ["Increases", "Decreases", "Remains unchanged", "Becomes zero"],
  },
  {
    chapter: "Coordination Compounds",
    text: "The coordination number of cobalt in [Co(NH3)6]Cl3 is:",
    options: ["6", "3", "4", "1"],
  },
  {
    chapter: "Coordination Compounds",
    text: "The correct IUPAC name of [Cu(NH3)4]SO4 is:",
    options: [
      "Tetraamminecopper(II) sulfate",
      "Tetrammine copper sulfate",
      "Copper ammine sulfate",
      "Ammoniacopper sulfate",
    ],
  },
  {
    chapter: "d- and f-Block Elements",
    text: "Transition elements are characterised by:",
    options: [
      "Partially filled d orbitals in atoms or common ions",
      "Completely filled d orbitals only",
      "Absence of variable oxidation states",
      "Zero metallic character",
    ],
  },
  {
    chapter: "d- and f-Block Elements",
    text: "Lanthanoid contraction leads to the similarity in size of:",
    options: ["4d and 5d series elements", "s-block and p-block elements", "Halogens and noble gases", "Alkanes and alkenes"],
  },
  {
    chapter: "Haloalkanes and Haloarenes",
    text: "Bromoethane on heating with aqueous KOH gives:",
    options: ["Ethanol", "Ethene", "Ethanal", "Ethanoic acid"],
  },
  {
    chapter: "Haloalkanes and Haloarenes",
    text: "Chlorobenzene is less reactive than chloroethane in nucleophilic substitution mainly because of:",
    options: ["Resonance in C-Cl bond", "Higher boiling point", "Lower density", "Absence of chlorine"],
  },
  {
    chapter: "Alcohols, Phenols and Ethers",
    text: "Ethanol reacts with sodium metal to liberate:",
    options: ["Hydrogen gas", "Oxygen gas", "Nitrogen gas", "Carbon dioxide"],
  },
  {
    chapter: "Alcohols, Phenols and Ethers",
    text: "Phenol is more acidic than ethanol because:",
    options: [
      "Phenoxide ion is resonance stabilised",
      "Phenol has higher molar mass",
      "Ethanol is unsaturated",
      "Phenol contains a ketone group",
    ],
  },
  {
    chapter: "Aldehydes, Ketones and Carboxylic Acids",
    text: "Aldehydes can be distinguished from ketones by:",
    options: ["Tollens' reagent", "Bromine water only", "Baeyer's reagent only", "Litmus paper"],
  },
  {
    chapter: "Aldehydes, Ketones and Carboxylic Acids",
    text: "Which compound gives a positive iodoform test?",
    options: ["Acetone", "Methanal", "Benzene", "Methanoic acid"],
  },
  {
    chapter: "Aldehydes, Ketones and Carboxylic Acids",
    text: "Carboxylic acids react with NaHCO3 to release:",
    options: ["CO2", "O2", "H2", "Cl2"],
  },
  {
    chapter: "Amines",
    text: "Amines are basic because nitrogen has a:",
    options: ["Lone pair of electrons", "Positive charge", "Double bond to oxygen", "High atomic mass"],
  },
  {
    chapter: "Amines",
    text: "Diazotisation of aniline is carried out at:",
    options: ["273 to 278 K", "350 K", "Room temperature only", "Below 200 K"],
  },
  {
    chapter: "Biomolecules",
    text: "Glucose is classified as an:",
    options: ["Aldohexose", "Ketopentose", "Amino acid", "Disaccharide"],
  },
  {
    chapter: "Biomolecules",
    text: "Proteins are polymers made of:",
    options: ["Amino acids", "Monosaccharides", "Nucleotides", "Fatty acids"],
  },
  {
    chapter: "Polymers",
    text: "Nylon-6,6 is a:",
    options: ["Condensation polymer", "Addition polymer", "Natural polymer", "Copolysaccharide"],
  },
  {
    chapter: "Chemistry in Everyday Life",
    text: "Aspirin is commonly used as an:",
    options: ["Analgesic", "Antiseptic", "Disinfectant", "Tranquiliser"],
  },
  {
    chapter: "Chemistry in Everyday Life",
    text: "Soap cleans by the formation of:",
    options: ["Micelles", "Crystals", "Radicals", "Polymers"],
  },
]);

const questionSections: SectionConfig[] = [
  {
    key: "maths",
    shortLabel: "Maths",
    title: "Mathematics",
    subtitle: "Calculus, algebra, vectors and probability revision for Class 12.",
    chapters: [
      "Differentiation",
      "Integrals",
      "Matrices",
      "Vector Algebra",
      "Probability",
    ],
    questions: mathsQuestions,
  },
  {
    key: "physics",
    shortLabel: "Physics",
    title: "Physics",
    subtitle: "Electricity, optics, modern physics and semiconductor practice.",
    chapters: [
      "Electrostatics",
      "Current Electricity",
      "EMI and AC",
      "Optics",
      "Modern Physics",
    ],
    questions: physicsQuestions,
  },
  {
    key: "chemistry",
    shortLabel: "Chemistry",
    title: "Chemistry",
    subtitle: "Physical, inorganic and organic Class 12 multiple choice review.",
    chapters: [
      "Solutions",
      "Electrochemistry",
      "Coordination",
      "Organic Chemistry",
      "Biomolecules",
    ],
    questions: chemistryQuestions,
  },
];

export function PYQView({ onUnlock }: PYQViewProps) {
  const trigger = useSecretTrigger(onUnlock, 5);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<SubjectKey>("maths");

  const currentSectionIndex = subjectOrder.indexOf(activeSection);

  const jumpToSection = (key: SubjectKey) => {
    setActiveSection(key);
    if (typeof document !== "undefined") {
      document.getElementById(`subject-${key}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const moveSection = (direction: -1 | 1) => {
    const nextIndex = currentSectionIndex + direction;
    if (nextIndex < 0 || nextIndex >= subjectOrder.length) return;
    jumpToSection(subjectOrder[nextIndex]);
  };

  const activeSectionConfig =
    questionSections.find((section) => section.key === activeSection) ??
    questionSections[0];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f4efe6] text-slate-900">
      <aside
        className={cn(
          "hidden shrink-0 overflow-hidden border-r border-slate-200 bg-[#fbf8f2] transition-all duration-300 ease-in-out md:flex",
          sidebarOpen ? "w-80" : "w-0 border-r-0"
        )}
      >
        <div className="flex h-full w-80 flex-col">
          <div className="border-b border-slate-200 px-6 py-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
              Study Mode
            </p>
            <h2 className="mt-2 font-academic text-3xl text-slate-900">
              BoardReady XII
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Class 12 PCM disguise with three subject sections and mobile-first
              practice flow.
            </p>
          </div>

          <div className="space-y-2 px-4 py-4">
            {questionSections.map((section, index) => {
              const styles = subjectStyles[section.key];

              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => jumpToSection(section.key)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-4 text-left transition-all",
                    activeSection === section.key
                      ? styles.navActive
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] opacity-80">
                        Section {index + 1}
                      </p>
                      <h3 className="mt-1 text-base font-semibold">
                        {section.title}
                      </h3>
                    </div>
                    <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium">
                      30 MCQs
                    </span>
                  </div>
                  <p className="mt-2 text-sm opacity-80">{section.subtitle}</p>
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-200 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Focus Chapters
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeSectionConfig.chapters.map((chapter) => (
                <span
                  key={chapter}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    subjectStyles[activeSectionConfig.key].chip
                  )}
                >
                  {chapter}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              All 90 questions stay on one continuous study page, with Mathematics
              first, then Physics, then Chemistry.
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-[#fbf8f2]/95 px-4 py-3 backdrop-blur-sm md:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((open) => !open)}
                className="hidden rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 md:inline-flex"
              >
                <Menu size={18} />
              </button>

              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">
                  Class 12 Revision Desk
                </p>
                <h1 className="truncate font-academic text-2xl text-slate-900">
                  PCM Mock Practice Pack
                </h1>
              </div>
            </div>

            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50"
            >
              <Search size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-[#f6f1e8]">
          <div className="mx-auto w-full max-w-5xl px-3 py-4 pb-10 md:px-8 md:py-8">
            <StudyAllSectionsPage
              activeSection={activeSection}
              onOpenSection={jumpToSection}
              onUnlock={trigger}
            />
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white/95 px-4 py-3 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => moveSection(-1)}
              disabled={currentSectionIndex === 0}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Previous section
            </button>

            <span className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
              {activeSectionConfig.title} | {currentSectionIndex + 1}/3
            </span>

            <button
              type="button"
              onClick={() => moveSection(1)}
              disabled={currentSectionIndex === subjectOrder.length - 1}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next section
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudyAllSectionsPage({
  activeSection,
  onOpenSection,
  onUnlock,
}: {
  activeSection: SubjectKey;
  onOpenSection: (key: SubjectKey) => void;
  onUnlock: () => void;
}) {
  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
              Board Pattern Set
            </p>
            <h2 className="mt-2 font-academic text-3xl text-slate-900 md:text-4xl">
              Class 12 PCM Question Bank
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 md:text-base">
              All questions are back on one continuous page. Mathematics comes
              first, then Physics, then Chemistry, with 30 multiple choice
              questions in each section.
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-[#f8f4eb] p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">Practice plan</p>
            <p className="mt-1">1 continuous page</p>
            <p>90 MCQs total</p>
            <p>Class 12 board-style cover</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2 md:gap-4">
        {questionSections.map((section, index) => {
          const styles = subjectStyles[section.key];

          return (
            <button
              key={section.key}
              type="button"
              onClick={() => onOpenSection(section.key)}
              className={cn(
                "min-w-0 rounded-[22px] border bg-gradient-to-br px-2 py-3 text-center shadow-sm transition-transform hover:-translate-y-0.5 md:rounded-[28px] md:px-4 md:py-5",
                styles.border,
                styles.summary,
                activeSection === section.key && "ring-2 ring-offset-2 ring-slate-300"
              )}
            >
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 md:text-[11px]">
                S{index + 1}
              </p>
              <h3 className="mt-2 font-academic text-lg text-slate-900 md:mt-3 md:text-3xl">
                {section.shortLabel}
              </h3>
              <p className="mt-1 text-[11px] font-medium text-slate-600 md:text-sm">
                30 questions
              </p>
              <p className={cn("mt-1 text-[10px] font-medium md:text-xs", styles.summaryText)}>
                Tap to open
              </p>
            </button>
          );
        })}
      </section>

      {questionSections.map((section, sectionIndex) => {
        const styles = subjectStyles[section.key];

        return (
          <section
            key={section.key}
            id={`subject-${section.key}`}
            className="scroll-mt-24 space-y-4"
          >
            <div
              className={cn(
                "rounded-[28px] border bg-white p-5 shadow-sm md:p-6",
                styles.border
              )}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                      styles.badge
                    )}
                  >
                    Section {sectionIndex + 1}
                  </span>
                  <h3 className="mt-3 font-academic text-3xl text-slate-900">
                    {section.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 md:text-base">
                    {section.subtitle}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <p className="font-semibold text-slate-800">Section load</p>
                  <p className="mt-1">30 multiple choice questions</p>
                  <p>One long page layout</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {section.chapters.map((chapter) => (
                  <span
                    key={chapter}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      styles.chip
                    )}
                  >
                    {chapter}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {section.questions.map((question, questionIndex) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  questionNumber={questionIndex + 1}
                  sectionKey={section.key}
                  secretOptionIndex={
                    section.key === "chemistry" && questionIndex === 29 ? 3 : undefined
                  }
                  onSecretTap={
                    section.key === "chemistry" && questionIndex === 29
                      ? onUnlock
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
        );
      })}

      <div className="border-t border-slate-200 pt-8">
        <div className="space-y-3 text-center">
          <p className="text-xs text-slate-400">
            BoardReady XII academic bundle for Class 12 revision sessions.
          </p>
          <p className="text-[11px] text-slate-300">
            All 90 questions are on one page with Maths, Physics and Chemistry
            sections.
          </p>
          <p className="text-[11px] text-slate-300">
            Academic policy | help desk | revision support
          </p>
          <p className="text-[10px] text-slate-200">session 12.5</p>
        </div>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  questionNumber,
  sectionKey,
  secretOptionIndex,
  onSecretTap,
}: {
  question: Question;
  questionNumber: number;
  sectionKey: SubjectKey;
  secretOptionIndex?: number;
  onSecretTap?: () => void;
}) {
  const styles = subjectStyles[sectionKey];

  return (
    <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Q{String(questionNumber).padStart(2, "0")}
            </span>
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                styles.badge
              )}
            >
              {question.chapter}
            </span>
          </div>

          <p className="mt-4 text-base leading-7 text-slate-800 md:text-lg">
            {question.text}
          </p>
        </div>

        <span className="text-xs font-mono text-slate-400">ID {question.id}</span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {question.options.map((option, index) => (
          <button
            key={`${question.id}-${index}`}
            type="button"
            onClick={secretOptionIndex === index ? onSecretTap : undefined}
            className={cn(
              "flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors",
              styles.option
            )}
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
              {String.fromCharCode(65 + index)}
            </span>
            <span className="text-sm leading-6 text-slate-700">{option}</span>
          </button>
        ))}
      </div>
    </article>
  );
}
