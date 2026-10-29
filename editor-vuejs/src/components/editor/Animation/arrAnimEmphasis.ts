export const arrAnimEmphasis = [
  {
    id: 1, // "fillcolor",
    l: "Fill Color",
    pn: "Fill Color",
    pv: "color",
    bh: [
      {
        ty: "color",
        dl: 0,
        du: 1,
        color: "#00ff00",
      },
    ],
  },
  {
    id: 2, //"changecolor",
    l: "Change Font",
    r: 1000,
    pn: "Custom",
  },
  {
    id: 3, //"changefontcolor",
    l: "Change Font Color",
    r: 1000,
    pn: "Color",
  },
  {
    id: 57, //"changefontsize",
    l: "Change Font Size",
    r: 1000,
    pn: "Custom",
  },
  {
    id: 58, //"changefontstyle",
    l: "Change Font Style",
    r: 1000,
    pn: "Custom",
  },
  {
    id: 6, //"growshrink",
    l: "Grow/Shrink",
    pn: "Size (%)",
    pv: [
      {
        l: "Zero",
        v: 0,
      },
      {
        l: "Tiny",
        v: 1,
      },
      {
        l: "Small",
        v: 2,
      },
      {
        l: "Smaller",
        v: 3,
      },
      {
        l: "Larger",
        v: 4,
      },
      {
        l: "Large",
        v: 5,
      },
      {
        l: "Huge",
        v: 6,
      },
    ],
    bh: {
      "0": [
        {
          ty: "scale",
          dl: 0,
          du: 1,
          byX: 0,
          byY: 0,
        },
      ],
      "1": [
        {
          ty: "scale",
          dl: 0,
          du: 1,
          byX: 25,
          byY: 25,
        },
      ],
      "2": [
        {
          ty: "scale",
          dl: 0,
          du: 1,
          byX: 50,
          byY: 50,
        },
      ],
      "3": [
        {
          ty: "scale",
          dl: 0,
          du: 1,
          byX: 75,
          byY: 75,
        },
      ],
      "4": [
        {
          ty: "scale",
          dl: 0,
          du: 1,
          byX: 150,
          byY: 150,
        },
      ],
      "5": [
        {
          ty: "scale",
          dl: 0,
          du: 1,
          byX: 200,
          byY: 200,
        },
      ],
      "6": [
        {
          ty: "scale",
          dl: 0,
          du: 1,
          byX: 400,
          byY: 400,
        },
      ],
    },
  },
  {
    id: 7, //"linecolor",
    l: "Line Color",
    r: 54,
    pn: "Color",
    pv: "color",
  },
  {
    id: 8, //"spin",
    l: "Spin",
    pn: "Angle (deg)",
    pv: "custom",
    bh: [
      {
        ty: "rotation",
        dl: 0,
        du: 1,
        by: 360,
      },
    ],
  },
  {
    id: 9, //"opacity",
    l: "Transparency",
    pn: "Amount",
    pv: [
      {
        l: "100%",
        v: 0,
      },
      {
        l: "90%",
        v: 0.1,
      },
      {
        l: "80%",
        v: 0.2,
      },
      {
        l: "70%",
        v: 0.3,
      },
      {
        l: "60%",
        v: 0.4,
      },
      {
        l: "50%",
        v: 0.5,
      },
      {
        l: "40%",
        v: 0.6,
      },
      {
        l: "30%",
        v: 0.7,
      },
      {
        l: "20%",
        v: 0.8,
      },
      {
        l: "10%",
        v: 0.9,
      },
    ],
    bh: [
      {
        ty: "set",
        dl: 0,
        du: 1,
        cm: "opacity",
        v: "0",
      },
      {
        ty: "filter",
        dl: 0,
        du: 1,
        v: 1,
        fty: "opacity",
        sty: 0,
      },
    ],
  },
  {
    id: 63, //"boldflash",
    l: "Bold Flash",
    r: 1000,
    pn: null,
  },
  {
    id: 14, //"blast",
    l: "Blast",
    pn: "Color",
    pv: "color",
    bh: [
      {
        ty: "color",
        dl: 0.1,
        du: 1.9,
        color: "#ff0000",
      },
      {
        ty: "color",
        dl: 0.1,
        du: 1.9,
        color: "#ff0000",
      },
      {
        ty: "scaleto",
        dl: 0,
        du: 0.2,
        fromX: 100,
        toX: 100,
        fromY: 100,
        toY: 5,
      },
      {
        ty: "scaleto",
        dl: 0.2,
        du: 0.2,
        fromX: 100,
        toX: 120,
        fromY: 5,
        toY: 150,
      },
      {
        ty: "scaleto",
        dl: 1.4,
        du: 0.6,
        fromX: 0,
        toX: 120,
        fromY: 0,
        toY: 150,
      },
    ],
  },
  {
    id: 65, //"boldreveal",
    l: "Bold Reveal",
    r: 1000,
  },
  {
    id: 16, //"brushoncolor",
    l: "Brush On Color",
    r: 1000,
    pn: "Color",
    pv: "color",
  },
  {
    id: 17, // "brushonunderline",
    l: "Brush On Underline",
    r: 1000,
    pn: null,
  },
  {
    id: 19, //"colorblend",
    l: "Color Blend",
    r: 54,
    pn: "Fill Color",
    pv: "color",
  },
  {
    id: 20, //"colorwave",
    l: "Color Wave",
    r: 54,
    pn: "Fill Color",
    pv: "color",
  },
  {
    id: 21, // "complementarycolor",
    l: "Complementary Color",
    r: 1000,
    pn: null,
  },
  {
    id: 22, // "complementarycolor2",
    l: "Complementary Color 2",
    r: 1000,
    pn: null,
  },
  {
    id: 23, //"contrastingcolor",
    l: "Contrasting Color",
    r: 1000,
    pn: null,
  },
  {
    id: 24, //"darken",
    l: "Darken",
    r: 1000,
    pn: null,
  },
  {
    id: 25, //"desaturate",
    l: "Desaturate",
    r: 1000,
    pn: null,
  },
  {
    id: 26, // "flashbulb",
    l: "Flash Bulb",
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 0.5,
        v: 0,
        fty: "fade",
        sty: 0,
      },
      {
        ty: "scale",
        dl: 0,
        du: 0.25,
        byX: 105,
        byY: 105,
      },
    ],
  },
  {
    id: 27, //"flicker",
    l: "Flicker",
    pn: "Color",
    pv: "color",
    bh: [
      {
        ty: "color",
        dl: 0,
        du: 0.25,
        color: "#ff0000",
      },
      {
        ty: "color",
        dl: 0,
        du: 0.25,
        color: "#ff0000",
      },
    ],
  },
  {
    id: 77, //"growwithcolor",
    l: "Grow With Color",
    r: 1000,
    pn: "Color",
    pv: "color",
  },
  {
    id: 30, //"lighten78",
    l: "Lighten",
    r: 1000,
    pn: null,
  },
  {
    id: 79, //"styleemphasis",
    l: "Style Emphasis",
    r: 1000,
    pn: null,
  },
  {
    id: 32, //"tweeter",
    l: "Teeter",
    pn: "Color",
    pv: "color",
    bh: [
      {
        ty: "color",
        dl: 0,
        du: 0.1,
        color: "#ffffff",
      },
      {
        ty: "rotation",
        dl: 0,
        du: 0.1,
        by: 2,
      },
      {
        ty: "rotation",
        dl: 0.2,
        du: 0.2,
        by: -4,
      },
      {
        ty: "rotation",
        dl: 0.4,
        du: 0.2,
        by: 4,
      },
      {
        ty: "rotation",
        dl: 0.6,
        du: 0.2,
        by: -4,
      },
      {
        ty: "rotation",
        dl: 0.8,
        du: 0.2,
        by: 2,
      },
    ],
  },
  {
    id: 33, //"verticalhighlight",
    l: "Vertical Highlight",
    pn: null,
    bh: [
      {
        ty: "color",
        dl: 0,
        du: 1.5,
        color: "#ff0000",
      },
      {
        ty: "color",
        dl: 0,
        du: 1.5,
        color: "#ff0000",
      },
      {
        ty: "scaleto",
        dl: 0,
        du: 1.5,
        fromX: 100,
        toX: 100,
        fromY: 100,
        toY: 140,
      },
    ],
  },
  {
    id: 34,
    l: "Wave",
    r: 1000,
    bh: [
      {
        ty: "motion",
        dl: 0,
        du: 0.5,
        cm: [
          {
            c: "M",
            p: [0, 0],
          },
          {
            c: "L",
            p: [0, -51.9336],
          },
        ],
        rv: 1,
      },
      {
        ty: "rotation",
        dl: 0,
        du: 0.25,
        by: 25,
        rw: 0,
      },
      {
        ty: "rotation",
        dl: 0.25,
        du: 0.25,
        by: -25,
        rw: 0,
      },
      {
        ty: "rotation",
        dl: 0.5,
        du: 0.25,
        by: -25,
        rw: 0,
      },
      {
        ty: "rotation",
        dl: 0.75,
        du: 0.25,
        by: 25,
        rw: 0,
      },
    ],
  },
  {
    id: 36,
    l: "Shimmer",
    r: 1000,
    bh: [
      {
        ty: "motion",
        dl: 0,
        du: 0.5,
        cm: [
          {
            c: "M",
            p: [0, 0],
          },
          {
            c: "L",
            p: [0, -51.9336],
          },
        ],
        rv: 1,
      },
      {
        ty: "rotation",
        dl: 0,
        du: 0.25,
        by: 25,
        rw: 0,
      },
      {
        ty: "rotation",
        dl: 0.25,
        du: 0.25,
        by: -25,
        rw: 0,
      },
      {
        ty: "rotation",
        dl: 0.5,
        du: 0.25,
        by: -25,
        rw: 0,
      },
      {
        ty: "rotation",
        dl: 0.75,
        du: 0.25,
        by: 25,
        rw: 0,
      },
    ],
  },
  {
    id: 35, //"blink",
    l: "Blink",
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: 21,
        cm: [
          {
            t: 0,
            v: "0",
          },
          {
            t: 0.5,
            v: "1",
          },
        ],
      },
    ],
  },
];
