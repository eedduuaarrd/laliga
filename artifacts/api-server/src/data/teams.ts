export interface SeedTeam {
  id: number;
  name: string;
  shortName: string;
  city: string;
  founded: number;
  stadium: string;
  primaryColor: string;
  secondaryColor: string;
  manager: string;
  formation: string;
  attackStrength: number;
  defenseStrength: number;
  homeAdvantage: number;
}

export const TEAMS: SeedTeam[] = [
  { id: 1, name: "Real Madrid", shortName: "RMA", city: "Madrid", founded: 1902, stadium: "Santiago Bernabéu", primaryColor: "#FFFFFF", secondaryColor: "#FEBE10", manager: "Xabi Alonso", formation: "4-3-3", attackStrength: 2.35, defenseStrength: 0.95, homeAdvantage: 1.18 },
  { id: 2, name: "FC Barcelona", shortName: "BAR", city: "Barcelona", founded: 1899, stadium: "Spotify Camp Nou", primaryColor: "#A50044", secondaryColor: "#004D98", manager: "Hansi Flick", formation: "4-2-3-1", attackStrength: 2.42, defenseStrength: 1.05, homeAdvantage: 1.20 },
  { id: 3, name: "Atlético Madrid", shortName: "ATM", city: "Madrid", founded: 1903, stadium: "Riyadh Air Metropolitano", primaryColor: "#CB3524", secondaryColor: "#272E61", manager: "Diego Simeone", formation: "4-4-2", attackStrength: 1.85, defenseStrength: 0.98, homeAdvantage: 1.22 },
  { id: 4, name: "Athletic Club", shortName: "ATH", city: "Bilbao", founded: 1898, stadium: "San Mamés", primaryColor: "#EE2523", secondaryColor: "#FFFFFF", manager: "Ernesto Valverde", formation: "4-2-3-1", attackStrength: 1.62, defenseStrength: 1.18, homeAdvantage: 1.28 },
  { id: 5, name: "Real Betis", shortName: "BET", city: "Sevilla", founded: 1907, stadium: "Benito Villamarín", primaryColor: "#0BB363", secondaryColor: "#FFFFFF", manager: "Manuel Pellegrini", formation: "4-2-3-1", attackStrength: 1.55, defenseStrength: 1.32, homeAdvantage: 1.15 },
  { id: 6, name: "Villarreal CF", shortName: "VIL", city: "Villarreal", founded: 1923, stadium: "Estadio de la Cerámica", primaryColor: "#FFE667", secondaryColor: "#005187", manager: "Marcelino", formation: "4-4-2", attackStrength: 1.68, defenseStrength: 1.25, homeAdvantage: 1.16 },
  { id: 7, name: "Real Sociedad", shortName: "RSO", city: "San Sebastián", founded: 1909, stadium: "Reale Arena", primaryColor: "#0067B1", secondaryColor: "#FFFFFF", manager: "Imanol Alguacil", formation: "4-3-3", attackStrength: 1.48, defenseStrength: 1.22, homeAdvantage: 1.18 },
  { id: 8, name: "Sevilla FC", shortName: "SEV", city: "Sevilla", founded: 1890, stadium: "Ramón Sánchez-Pizjuán", primaryColor: "#D81920", secondaryColor: "#FFFFFF", manager: "Matías Almeyda", formation: "4-3-3", attackStrength: 1.40, defenseStrength: 1.45, homeAdvantage: 1.20 },
  { id: 9, name: "Valencia CF", shortName: "VAL", city: "Valencia", founded: 1919, stadium: "Mestalla", primaryColor: "#EE3524", secondaryColor: "#000000", manager: "Carlos Corberán", formation: "4-2-3-1", attackStrength: 1.32, defenseStrength: 1.42, homeAdvantage: 1.20 },
  { id: 10, name: "RC Celta", shortName: "CEL", city: "Vigo", founded: 1923, stadium: "Abanca-Balaídos", primaryColor: "#8AB8E8", secondaryColor: "#FFFFFF", manager: "Claudio Giráldez", formation: "4-3-3", attackStrength: 1.58, defenseStrength: 1.38, homeAdvantage: 1.14 },
  { id: 11, name: "Getafe CF", shortName: "GET", city: "Getafe", founded: 1983, stadium: "Coliseum", primaryColor: "#005999", secondaryColor: "#FFFFFF", manager: "José Bordalás", formation: "5-3-2", attackStrength: 1.05, defenseStrength: 1.28, homeAdvantage: 1.18 },
  { id: 12, name: "Rayo Vallecano", shortName: "RAY", city: "Madrid", founded: 1924, stadium: "Vallecas", primaryColor: "#E53027", secondaryColor: "#FFFFFF", manager: "Íñigo Pérez", formation: "4-2-3-1", attackStrength: 1.30, defenseStrength: 1.40, homeAdvantage: 1.22 },
  { id: 13, name: "CA Osasuna", shortName: "OSA", city: "Pamplona", founded: 1920, stadium: "El Sadar", primaryColor: "#D91A21", secondaryColor: "#0A346F", manager: "Alessio Lisci", formation: "4-3-3", attackStrength: 1.18, defenseStrength: 1.32, homeAdvantage: 1.24 },
  { id: 14, name: "RCD Mallorca", shortName: "MLL", city: "Palma", founded: 1916, stadium: "Mallorca Son Moix", primaryColor: "#E20613", secondaryColor: "#000000", manager: "Jagoba Arrasate", formation: "4-4-2", attackStrength: 1.10, defenseStrength: 1.35, homeAdvantage: 1.16 },
  { id: 15, name: "RCD Espanyol", shortName: "ESP", city: "Barcelona", founded: 1900, stadium: "RCDE Stadium", primaryColor: "#005CA9", secondaryColor: "#FFFFFF", manager: "Manolo González", formation: "4-4-2", attackStrength: 1.35, defenseStrength: 1.38, homeAdvantage: 1.15 },
  { id: 16, name: "Deportivo Alavés", shortName: "ALA", city: "Vitoria", founded: 1921, stadium: "Mendizorroza", primaryColor: "#0067B1", secondaryColor: "#FFFFFF", manager: "Eduardo Coudet", formation: "4-2-3-1", attackStrength: 1.12, defenseStrength: 1.40, homeAdvantage: 1.15 },
  { id: 17, name: "Girona FC", shortName: "GIR", city: "Girona", founded: 1930, stadium: "Estadi Montilivi", primaryColor: "#D6001C", secondaryColor: "#FFFFFF", manager: "Míchel", formation: "4-2-3-1", attackStrength: 1.25, defenseStrength: 1.50, homeAdvantage: 1.14 },
  { id: 18, name: "Levante UD", shortName: "LEV", city: "Valencia", founded: 1909, stadium: "Ciutat de València", primaryColor: "#003B7A", secondaryColor: "#A40000", manager: "Julián Calero", formation: "4-2-3-1", attackStrength: 1.20, defenseStrength: 1.55, homeAdvantage: 1.16 },
  { id: 19, name: "Elche CF", shortName: "ELC", city: "Elche", founded: 1923, stadium: "Martínez Valero", primaryColor: "#FFFFFF", secondaryColor: "#0A8E3F", manager: "Eder Sarabia", formation: "4-2-3-1", attackStrength: 1.15, defenseStrength: 1.42, homeAdvantage: 1.18 },
  { id: 20, name: "Real Oviedo", shortName: "OVI", city: "Oviedo", founded: 1926, stadium: "Carlos Tartiere", primaryColor: "#003DA5", secondaryColor: "#FFFFFF", manager: "Veljko Paunović", formation: "4-4-2", attackStrength: 1.00, defenseStrength: 1.58, homeAdvantage: 1.18 },
];

export function buildCrestUrl(team: SeedTeam): string {
  // Use UI Avatars-like SVG generated from team initials and colors. No external dep.
  const bg = team.primaryColor.replace("#", "");
  const fg = team.secondaryColor.replace("#", "");
  const text = encodeURIComponent(team.shortName);
  return `https://placehold.co/120x120/${bg}/${fg}/svg?text=${text}&font=raleway`;
}
