// Original native compositions, with explicit spatial arrangements per family.
// Palette changes never generate extra candidates; all use the deck's shared theme.
const families = ['editorial-ivory', 'midnight-signal', 'terracotta-studio', 'botanical-notes',
  'electric-violet', 'swiss-red', 'coastal-blue', 'copper-ledger', 'citrus-workshop', 'mono-architecture'];
const box = ([x,y,w,h], size = 22) => ({x,y,w,h,size,transparent:true,fill:'#F5F4EF',color:'#0A0A0A'});
const heading = [56,40,1168,132];
// Each row is a distinct composition: heading, body panels (or caption), and visual.
const visual = [
  [heading, [56,204,360,440], [456,204,768,440]],
  [heading, [916,204,308,440], [56,204,820,440]],
  [heading, [96,570,1088,108], [56,192,1168,350]],
  [[56,60,390,210], [56,340,390,300], [486,56,738,600]],
  [[870,60,354,220], [870,330,354,326], [56,56,774,600]],
  [[56,40,1168,132], [56,204,1168,116], [56,350,1168,306]],
  [[56,40,700,132], [844,40,380,230], [56,304,1168,352]],
  [[56,40,1168,132], [56,208,260,440], [356,208,868,440]],
  [[56,40,1168,132], [56,502,450,154], [546,202,678,454]],
  [[56,40,1168,132], [884,490,340,166], [56,202,788,454]],
];
const arrangements = [
  [heading, [56,216,352,420],[464,216,352,420],[872,216,352,420]],
  [[56,60,330,560],[430,56,794,180],[430,268,794,180],[430,480,794,180]],
  [heading,[56,210,556,446],[650,210,574,206],[650,450,574,206]],
  [heading,[56,210,574,206],[56,450,574,206],[668,210,556,446]],
  [heading,[56,206,352,268],[464,294,352,268],[872,382,352,268]],
  [heading,[56,206,1168,184],[56,426,560,230],[656,426,568,230]],
  [heading,[56,206,560,230],[656,206,568,230],[56,472,1168,184]],
  [[864,60,360,540],[56,56,754,180],[56,268,754,180],[56,480,754,180]],
  [heading,[56,382,352,268],[464,206,352,268],[872,382,352,268]],
  [heading,[56,206,352,268],[464,382,352,268],[872,206,352,268]],
];
const openings = [
  [[56,100,730,290],[56,460,730,180]],
  [[160,154,960,270],[240,484,800,150]],
  [[56,340,1168,230],[56,600,1168,80]],
  [[56,70,510,550],[680,300,544,280]],
  [[690,70,534,550],[56,300,540,280]],
  [[56,70,1168,220],[56,354,750,240]],
  [[56,70,780,240],[466,440,758,200]],
  [[466,70,758,240],[56,440,780,200]],
  [[180,70,920,280],[180,410,920,240]],
  [[56,70,1168,220],[630,380,594,240]],
];
const explanations = [
  [heading,[56,210,720,446],[816,210,408,446]],
  [[56,56,330,600],[430,56,794,284],[430,376,794,284]],
  [heading,[56,210,1168,206],[56,452,1168,204]],
  [heading,[56,210,408,446],[504,210,720,446]],
  [[56,56,1168,132],[56,220,560,330],[656,326,568,330]],
  [[56,56,1168,132],[56,326,560,330],[656,220,568,330]],
  [[864,56,360,600],[56,56,754,284],[56,376,754,284]],
  [heading,[160,210,960,284],[280,530,720,126]],
  [[56,56,1168,132],[56,220,1168,126],[280,382,944,274]],
  [[56,56,1168,132],[280,220,944,274],[56,530,1168,126]],
];
function connectors(nodes) {
  return nodes.slice(0,-1).flatMap((a,i) => {
    const b=nodes[i+1], ax=a[0]+a[2]/2, ay=a[1]+a[3]/2, bx=b[0]+b[2]/2, by=b[1]+b[3]/2;
    // Thin orthogonal connector segments are behind the editable nodes.
    return [
      {name:'Process connector',x:Math.min(ax,bx),y:ay,w:Math.max(3,Math.abs(bx-ax)),h:3,color:'accent'},
      {name:'Process connector',x:bx,y:Math.min(ay,by),w:3,h:Math.max(3,Math.abs(by-ay)),color:'accent'},
    ];
  });
}

export function createPointsLayout(family, theme) {
  const columns = (count, hasTitle) => {
    const points = count - Number(hasTitle);
    if (points < 2 || points > 5) return null;
    const gap = 20, width = (1168 - gap * (points - 1)) / points;
    const panels = Array.from({ length: points }, (_, index) => ({
      x: 56 + index * (width + gap), y: 204, w: width, h: 452,
    }));
    return {
      slots: [
        ...(hasTitle ? [box([56, 40, 1168, 116], 38)] : []),
        ...panels.map(panel => ({
          ...box([panel.x + 18, panel.y + 42, panel.w - 36, panel.h - 60], 20),
          inset: 0, lineHeight: 1.4, alignTop: true,
        })),
      ],
      artwork: panels.flatMap(panel => [
        { ...panel, name: 'Point panel', color: 'surface', radius: 5 },
        { x: panel.x + 18, y: panel.y + 20, w: 36, h: 4, name: 'Point rule', color: 'accent' },
      ]),
    };
  };
  return {
    id: theme ? `source/${family}/points` : `${family}-points`,
    family, ...(theme ? { theme, generic: true } : {}),
    label: 'Bullet points (2–5)', templateRole: 'points',
    description: 'A heading and two to five talking points in adaptable columns.',
    generated: true, acceptsList: true, columns,
    slots: (count, hasTitle = true) => columns(count, hasTitle)?.slots || [],
  };
}

const builtinPoints = createPointsLayout('builtin-ocean');
export const builtinRoleLayouts = [
  builtinPoints,
  { ...builtinPoints, id: 'builtin-ocean-summary', label: 'Summary', templateRole: 'summary', requiresTitle: true },
  { id: 'builtin-ocean-closing', label: 'Thank you', templateRole: 'closing', isClosing: true,
    defaultTitle: 'Thank you', requiresTitle: true,
    description: 'A thank-you closing slide with an optional subtitle.',
    slots: count => count === 1 || count === 2 ? [
      box([120, 210, 1040, 180], 64),
      ...(count === 2 ? [box([240, 420, 800, 120], 24)] : []),
    ] : [] },
];

const layoutRoles = { cards: 'points', flow: 'points', 'photo-points': 'photo' };
export const generatedLayouts = families.flatMap((family,index) => {
  const pointLayout = createPointsLayout(family);
  const create=(role,description,slots,extra={})=>({id:`${family}-${role}`,description,
    requiresTitle:true,generated:true,templateRole:layoutRoles[role] || role,slots,...extra});
  const [vh,caption,image]=visual[index], panels=arrangements[index], prose=explanations[index];
  const columnPanels = panels.slice(1);
  const horizontal = columnPanels.every((panel, i) => i === 0 ||
    panel[0] >= columnPanels[i - 1][0] + columnPanels[i - 1][2]);
  const dynamicColumns = flow => horizontal ? { columns: (count, hasTitle) => {
    const points = count - Number(hasTitle);
    if (points < 2 || points > 6) return null;
    const first = columnPanels[0], last = columnPanels.at(-1);
    const gap = columnPanels[1][0] - first[0] - first[2];
    const width = (last[0] + last[2] - first[0] - gap * (points - 1)) / points;
    const resized = Array.from({ length: points }, (_, i) => [
      first[0] + i * (width + gap), columnPanels[i % columnPanels.length][1],
      width, columnPanels[i % columnPanels.length][3],
    ]);
    return { slots: [
      ...(hasTitle ? [{ ...box(panels[0], 38), transparent: true }] : []),
      ...resized.map(panel => box(panel, 23)),
    ], artwork: flow ? connectors(resized) : [] };
  } } : {};
  const images = kind => ({ acceptsList:true,singleImage:true,visualKind:kind,
    image:{x:image[0],y:image[1],w:image[2],h:image[3]} });
  const visualSlots=n=>n===1?[box(vh,38)]:n===2?[box(vh,38),box(caption,22)]:[];
  const photoOnRight = [1, 3, 6, 8].includes(index);
  const photoWidth = index % 3 === 0 ? 480 : 520;
  const pointX = photoOnRight ? 56 : 56 + photoWidth + 48;
  const pointWidth = 1168 - photoWidth - 48;
  const photoPoints = (count, hasTitle) => {
    const points = count - Number(hasTitle);
    if (points < 3 || points > 5) return null;
    const gap = 16;
    const rowHeight = (464 - (points - 1) * gap) / points;
    return {
      slots: [
        ...(hasTitle ? [box([56, 40, 1168, 116], 38)] : []),
        ...Array.from({ length: points }, (_, i) => ({
          ...box([pointX + 20, 192 + i * (rowHeight + gap), pointWidth - 20, rowHeight], 20),
          inset: 0, lineHeight: 1.35, alignTop: true,
        })),
      ],
      artwork: Array.from({ length: points }, (_, i) => ({
        name: 'Talking point accent', x: pointX, y: 198 + i * (rowHeight + gap),
        w: 5, h: 24, color: 'accent',
      })),
    };
  };
  return [
    pointLayout,
    create('cover','Presentation opening with a headline and optional subtitle.',n=>n===1||n===2?
      openings[index].slice(0,n).map((r,i)=>box(r,i?24:48)):[], {isCover:true}),
    create('closing','A thank-you closing slide with an optional subtitle.',n=>n===1||n===2?
      openings[index].slice(0,n).map((r,i)=>box(r,i?24:48)):[], {isClosing:true,defaultTitle:'Thank you'}),
    create('summary','Key takeaways or a review of the presentation.',
      n=>pointLayout.slots(n),{acceptsList:true,columns:pointLayout.columns}),
    create('text','Heading, explanation and a separate takeaway panel.',n=>n>=1&&n<=3?
      prose.slice(0,n).map((r,i)=>box(r,i?23:38)):[],{acceptsList:true}),
    create('cards','Up to three parallel ideas in editable panels.',n=>n>=2&&n<=4?
      panels.slice(0,n).map((r,i)=>({...box(r,i?23:38),transparent:i===0})):[],{acceptsList:true,...dynamicColumns(false)}),
    create('photo','Existing photograph with a headline and optional explanation.',visualSlots,images('photo')),
    create('photo-points','A photograph beside three to five talking points, with a heading and one point per row.',
      count => photoPoints(count, true)?.slots || [], {
        acceptsList: true, singleImage: true, visualKind: 'photo', columns: photoPoints,
        image: { x: photoOnRight ? 1224 - photoWidth : 56, y: 192, w: photoWidth, h: 464 },
      }),
    create('chart','Existing chart and interpretation; preserves the original data.',visualSlots,images('chart')),
    create('flow','Three connected stages of a process or workflow.',n=>n===4?
      panels.map((r,i)=>({...box(r,i?23:38),transparent:i===0})):[],
      {acceptsList:true,artwork:connectors(panels.slice(1)),...dynamicColumns(true)}),
  ];
});
