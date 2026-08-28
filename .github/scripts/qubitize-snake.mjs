import { readFile, writeFile } from "node:fs/promises";

const files = process.argv.slice(2);
const marker = "<!-- QUBIT_FEED_LAYER -->";

if (!files.length) {
  throw new Error("Pass at least one generated snake SVG path.");
}

const pellets = [
  { x: 12, y: 31, state: "|0⟩", delay: 0.0 },
  { x: 25, y: 61, state: "|+⟩", delay: 1.4 },
  { x: 39, y: 42, state: "|1⟩", delay: 2.8 },
  { x: 54, y: 70, state: "|ψ⟩", delay: 4.2 },
  { x: 68, y: 35, state: "|−⟩", delay: 5.6 },
  { x: 81, y: 59, state: "|+⟩", delay: 7.0 },
  { x: 94, y: 39, state: "|1⟩", delay: 8.4 },
];

function pellet({ x, y, state, delay }) {
  const begin = `-${delay}s`;
  const ringBegin = `-${delay}s`;

  return `
    <g opacity="0">
      <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.08;.54;.60;1" dur="12s" begin="${begin}" repeatCount="indefinite"/>
      <circle cx="${x}%" cy="${y}%" r="1.05%" fill="url(#qf-core)" filter="url(#qf-glow)"/>
      <ellipse cx="${x}%" cy="${y}%" rx="2.15%" ry=".72%" fill="none" stroke="#A78BFA" stroke-width="1.25" stroke-dasharray="4 3"><animate attributeName="stroke-dashoffset" values="0;-28" dur="2.8s" repeatCount="indefinite"/></ellipse>
      <ellipse cx="${x}%" cy="${y}%" rx=".72%" ry="2.15%" fill="none" stroke="#67E8F9" stroke-width="1" stroke-dasharray="3 4"><animate attributeName="stroke-dashoffset" values="0;28" dur="3.3s" repeatCount="indefinite"/></ellipse>
      <text x="${x}%" y="${y + 6}%" fill="#C4B5FD" font-size="7.5" text-anchor="middle">${state}</text>
    </g>
    <circle cx="${x}%" cy="${y}%" r="1%" fill="none" stroke="#67E8F9" stroke-width="1.5" opacity="0">
      <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.53;.56;.66;1" dur="12s" begin="${ringBegin}" repeatCount="indefinite"/>
      <animate attributeName="r" values="1%;1%;3.8%;5.2%;5.2%" keyTimes="0;.53;.59;.66;1" dur="12s" begin="${ringBegin}" repeatCount="indefinite"/>
    </circle>`;
}

const layer = `
  ${marker}
  <defs>
    <radialGradient id="qf-core"><stop stop-color="#CFFAFE"/><stop offset=".35" stop-color="#22D3EE"/><stop offset="1" stop-color="#8B5CF6"/></radialGradient>
    <filter id="qf-glow" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="2.2" result="qf-b"/><feMerge><feMergeNode in="qf-b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g id="qubit-feed" pointer-events="none" font-family="ui-monospace,SFMono-Regular,Consolas,monospace">
    <rect x="1.5%" y="3%" width="20%" height="11%" rx="4" fill="#02060D" fill-opacity=".82" stroke="#22D3EE" stroke-opacity=".28"/>
    <circle cx="3.3%" cy="8.5%" r=".45%" fill="#34D399" filter="url(#qf-glow)"><animate attributeName="opacity" values=".25;1;.25" dur="1.4s" repeatCount="indefinite"/></circle>
    <text x="4.5%" y="10.3%" fill="#67E8F9" font-size="8" letter-spacing="1">QUBIT_FEED::ACTIVE</text>
    ${pellets.map(pellet).join("")}
  </g>`;

for (const file of files) {
  const source = await readFile(file, "utf8");
  if (source.includes(marker)) {
    console.log(`qubit feed already present: ${file}`);
    continue;
  }
  if (!/<\/svg>\s*$/.test(source)) {
    throw new Error(`Invalid SVG ending: ${file}`);
  }
  await writeFile(file, source.replace(/<\/svg>\s*$/, `${layer}\n</svg>\n`));
  console.log(`qubitized: ${file}`);
}
