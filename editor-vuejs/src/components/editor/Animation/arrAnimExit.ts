export const arrAnimExit = [
  {
    id: 1, //"appear",
    l: "Disappear",
    rv: 0,
    pn: null,
    bh: [],
  },
  {
    id: 2, //"fly",
    l: "Fly Out",
    rv: 0,
    pn: "Direction",
    pv: [
      {
        l: "To Bottom",
        v: 3,
      },
      {
        l: "To Left",
        v: 4,
      },
      {
        l: "To Right",
        v: 2,
      },
      {
        l: "To Top",
        v: 1,
      },
      {
        l: "To Bottom-Left",
        v: 9,
      },
      {
        l: "To Bottom-Right",
        v: 8,
      },
      {
        l: "To Top-Left",
        v: 6,
      },
      {
        l: "To Top-Right",
        v: 7,
      },
    ],
    bh: {
      "1": [
        {
          ty: "props",
          dl: 0,
          du: 1,
          pr: "ppt_x",
          cm: [
            {
              t: 0,
              v: "ppt_x",
            },
            {
              t: 1,
              v: "ppt_x",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 1,
          pr: "ppt_y",
          cm: [
            {
              t: 0,
              v: "ppt_y",
            },
            {
              t: 1,
              v: "0-ppt_h/2",
            },
          ],
        },
      ],
      "2": [
        {
          ty: "props",
          dl: 0,
          du: 1,
          pr: "ppt_x",
          cm: [
            {
              t: 0,
              v: "ppt_x",
            },
            {
              t: 1,
              v: "1+ppt_w/2",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 1,
          pr: "ppt_y",
          cm: [
            {
              t: 0,
              v: "ppt_y",
            },
            {
              t: 1,
              v: "ppt_y",
            },
          ],
        },
      ],
      "3": [
        {
          ty: "props",
          dl: 0,
          du: 1,
          pr: "ppt_x",
          cm: [
            {
              t: 0,
              v: "ppt_x",
            },
            {
              t: 1,
              v: "ppt_x",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 1,
          pr: "ppt_y",
          cm: [
            {
              t: 0,
              v: "ppt_y",
            },
            {
              t: 1,
              v: "1+ppt_h/2",
            },
          ],
        },
      ],
      "4": [
        {
          ty: "props",
          dl: 0,
          du: 1,
          pr: "ppt_x",
          cm: [
            {
              t: 0,
              v: "ppt_x",
            },
            {
              t: 1,
              v: "0-ppt_w/2",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 1,
          pr: "ppt_y",
          cm: [
            {
              t: 0,
              v: "ppt_y",
            },
            {
              t: 1,
              v: "ppt_y",
            },
          ],
        },
      ],
      "6": [
        {
          ty: "props",
          dl: 0,
          du: 1,
          pr: "ppt_x",
          cm: [
            {
              t: 0,
              v: "ppt_x",
            },
            {
              t: 1,
              v: "0-ppt_w/2",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 1,
          pr: "ppt_y",
          cm: [
            {
              t: 0,
              v: "ppt_y",
            },
            {
              t: 1,
              v: "0-ppt_h/2",
            },
          ],
        },
      ],
      "7": [
        {
          ty: "props",
          dl: 0,
          du: 1,
          pr: "ppt_x",
          cm: [
            {
              t: 0,
              v: "ppt_x",
            },
            {
              t: 1,
              v: "1+ppt_w/2",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 1,
          pr: "ppt_y",
          cm: [
            {
              t: 0,
              v: "ppt_y",
            },
            {
              t: 1,
              v: "0-ppt_h/2",
            },
          ],
        },
      ],
      "8": [
        {
          ty: "props",
          dl: 0,
          du: 1,
          pr: "ppt_x",
          cm: [
            {
              t: 0,
              v: "ppt_x",
            },
            {
              t: 1,
              v: "1+ppt_w/2",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 1,
          pr: "ppt_y",
          cm: [
            {
              t: 0,
              v: "ppt_y",
            },
            {
              t: 1,
              v: "1+ppt_h/2",
            },
          ],
        },
      ],
      "9": [
        {
          ty: "props",
          dl: 0,
          du: 1,
          pr: "ppt_x",
          cm: [
            {
              t: 0,
              v: "ppt_x",
            },
            {
              t: 1,
              v: "0-ppt_w/2",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 1,
          pr: "ppt_y",
          cm: [
            {
              t: 0,
              v: "ppt_y",
            },
            {
              t: 1,
              v: "1+ppt_h/2",
            },
          ],
        },
      ],
    },
  },
  {
    id: 3, //"blinds",
    l: "Blinds",
    r: 22,
    rv: 0,
    pn: "Direction",
    pv: [
      {
        l: "Horizontal",
        v: 16,
        rv: 1,
      },
      {
        l: "Vertical",
        v: 17,
        rv: 2,
      },
    ],
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 1,
        fty: "wipe",
        sty: "in",
      },
    ],
  },
  {
    id: 4, //"box",
    l: "Box Out",
    rv: 0,
    pn: "Direction",
    pv: [
      {
        l: "In",
        v: 19,
      },
      {
        l: "Out",
        v: 20,
      },
    ],
    bh: {
      "19": [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          v: 0,
          fty: "box",
          sty: "out",
        },
      ],
      "20": [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          v: 0,
          fty: "box",
          sty: "out",
        },
      ],
    },
  },
  {
    id: 5, //"checkboard",
    l: "Checkboard",
    r: 22,
    rv: 0,
    pn: "Direction",
    pv: [
      {
        l: "Horizontal",
        v: 16,
        rv: 1,
      },
      {
        l: "Vertical",
        v: 17,
        rv: 2,
      },
    ],
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 1,
        fty: "wipe",
        sty: "in",
        v: 0,
      },
    ],
  },
  {
    id: 6, // "circle",
    l: "Circle",
    r: 4,
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 1,
        fty: "box",
        sty: "in",
        v: 0,
      },
    ],
  },
  {
    id: 7, //"crawl",
    l: "Crawl Out",
    r: 2,
    rv: 0,
    pn: null,
  },
  {
    id: 8, //"diamond",
    l: "Diamond",
    r: 4,
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 1,
        fty: "box",
        sty: "in",
        v: 0,
      },
    ],
  },
  {
    id: 9, //"dissolve",
    l: "Dissolve",
    r: 10,
    rv: 0,
    pn: null,
  },
  {
    id: 10, //"fade",
    l: "Fade Out",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 0.5,
        rv: 0,
        fty: "fade",
        sty: 0,
        v: 0,
      },
    ],
  },
  {
    id: 11, //"flashonce",
    l: "Flash Once",
    rv: 0,
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
  {
    id: 12, //"peek",
    l: "Peek Out",
    rv: 0,
    pn: "Direction",
    pv: [
      {
        l: "To Bottom",
        v: 3,
      },
      {
        l: "To Left",
        v: 4,
      },
      {
        l: "To Right",
        v: 2,
      },
      {
        l: "To Top",
        v: 1,
      },
    ],
    bh: {
      "1": [
        {
          ty: "filter",
          dl: 0,
          du: 0.5,
          v: 0,
          fty: "slide",
          sty: "fromBottom",
        },
      ],
      "2": [
        {
          ty: "filter",
          dl: 0,
          du: 0.5,
          v: 0,
          fty: "slide",
          sty: "fromRight",
        },
      ],
      "3": [
        {
          ty: "filter",
          dl: 0,
          du: 0.5,
          v: 0,
          fty: "slide",
          sty: "fromTop",
        },
      ],
      "4": [
        {
          ty: "filter",
          dl: 0,
          du: 0.5,
          v: 0,
          fty: "slide",
          sty: "fromLeft",
        },
      ],
    },
  },
  {
    id: 13, //"plus",
    l: "Plus",
    r: 4,
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 1,
        fty: "box",
        sty: "in",
        v: 0,
      },
    ],
  },
  {
    id: 14, //"ranombars",
    l: "Random Bars",
    r: 10,
    rv: 0,
    pn: null,
  },
  {
    id: 15, //"spiral",
    l: "Spiral Out",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_w",
        cm: [
          {
            t: 0,
            v: "ppt_w",
          },
          {
            t: 1,
            v: "0",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_h",
        cm: [
          {
            t: 0,
            v: "ppt_h",
          },
          {
            t: 1,
            v: "0",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "ppt_x",
          },
          {
            t: 0.05,
            v: "ppt_x+-0.0500*(ppt_x*0.9511+(1-ppt_y)*0.3090)",
          },
          {
            t: 0.1,
            v: "ppt_x+-0.1000*(ppt_x*0.8090+(1-ppt_y)*0.5878)",
          },
          {
            t: 0.15,
            v: "ppt_x+-0.1500*(ppt_x*0.5878+(1-ppt_y)*0.8090)",
          },
          {
            t: 0.2,
            v: "ppt_x+-0.2000*(ppt_x*0.3090+(1-ppt_y)*0.9511)",
          },
          {
            t: 0.25,
            v: "ppt_x+-0.2500*(ppt_x*-0.0000+(1-ppt_y)*1.0000)",
          },
          {
            t: 0.3,
            v: "ppt_x+-0.3000*(ppt_x*-0.3090+(1-ppt_y)*0.9511)",
          },
          {
            t: 0.35,
            v: "ppt_x+-0.3500*(ppt_x*-0.5878+(1-ppt_y)*0.8090)",
          },
          {
            t: 0.4,
            v: "ppt_x+-0.4000*(ppt_x*-0.8090+(1-ppt_y)*0.5878)",
          },
          {
            t: 0.45,
            v: "ppt_x+-0.4500*(ppt_x*-0.9511+(1-ppt_y)*0.3090)",
          },
          {
            t: 0.5,
            v: "ppt_x+-0.5000*(ppt_x*-1.0000+(1-ppt_y)*-0.0000)",
          },
          {
            t: 0.55,
            v: "ppt_x+-0.5500*(ppt_x*-0.9511+(1-ppt_y)*-0.3090)",
          },
          {
            t: 0.6,
            v: "ppt_x+-0.6000*(ppt_x*-0.8090+(1-ppt_y)*-0.5878)",
          },
          {
            t: 0.65,
            v: "ppt_x+-0.6500*(ppt_x*-0.5878+(1-ppt_y)*-0.8090)",
          },
          {
            t: 0.7,
            v: "ppt_x+-0.7000*(ppt_x*-0.3090+(1-ppt_y)*-0.9511)",
          },
          {
            t: 0.75,
            v: "ppt_x+-0.7500*(ppt_x*0.0000+(1-ppt_y)*-1.0000)",
          },
          {
            t: 0.8,
            v: "ppt_x+-0.8000*(ppt_x*0.3090+(1-ppt_y)*-0.9511)",
          },
          {
            t: 0.85,
            v: "ppt_x+-0.8500*(ppt_x*0.5878+(1-ppt_y)*-0.8090)",
          },
          {
            t: 0.9,
            v: "ppt_x+-0.9000*(ppt_x*0.8090+(1-ppt_y)*-0.5878)",
          },
          {
            t: 0.95,
            v: "ppt_x+-0.9500*(ppt_x*0.9511+(1-ppt_y)*-0.3090)",
          },
          {
            t: 1,
            v: "ppt_x+-1.0000*(ppt_x*1.0000+(1-ppt_y)*0.0000)",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "ppt_y",
          },
          {
            t: 0.05,
            v: "ppt_y+-0.0500*(ppt_x*0.3090-(1-ppt_y)*0.9511)",
          },
          {
            t: 0.1,
            v: "ppt_y+-0.1000*(ppt_x*0.5878-(1-ppt_y)*0.8090)",
          },
          {
            t: 0.15,
            v: "ppt_y+-0.1500*(ppt_x*0.8090-(1-ppt_y)*0.5878)",
          },
          {
            t: 0.2,
            v: "ppt_y+-0.2000*(ppt_x*0.9511-(1-ppt_y)*0.3090)",
          },
          {
            t: 0.25,
            v: "ppt_y+-0.2500*(ppt_x*1.0000-(1-ppt_y)*-0.0000)",
          },
          {
            t: 0.3,
            v: "ppt_y+-0.3000*(ppt_x*0.9511-(1-ppt_y)*-0.3090)",
          },
          {
            t: 0.35,
            v: "ppt_y+-0.3500*(ppt_x*0.8090-(1-ppt_y)*-0.5878)",
          },
          {
            t: 0.4,
            v: "ppt_y+-0.4000*(ppt_x*0.5878-(1-ppt_y)*-0.8090)",
          },
          {
            t: 0.45,
            v: "ppt_y+-0.4500*(ppt_x*0.3090-(1-ppt_y)*-0.9511)",
          },
          {
            t: 0.5,
            v: "ppt_y+-0.5000*(ppt_x*-0.0000-(1-ppt_y)*-1.0000)",
          },
          {
            t: 0.55,
            v: "ppt_y+-0.5500*(ppt_x*-0.3090-(1-ppt_y)*-0.9511)",
          },
          {
            t: 0.6,
            v: "ppt_y+-0.6000*(ppt_x*-0.5878-(1-ppt_y)*-0.8090)",
          },
          {
            t: 0.65,
            v: "ppt_y+-0.6500*(ppt_x*-0.8090-(1-ppt_y)*-0.5878)",
          },
          {
            t: 0.7,
            v: "ppt_y+-0.7000*(ppt_x*-0.9511-(1-ppt_y)*-0.3090)",
          },
          {
            t: 0.75,
            v: "ppt_y+-0.7500*(ppt_x*-1.0000-(1-ppt_y)*0.0000)",
          },
          {
            t: 0.8,
            v: "ppt_y+-0.8000*(ppt_x*-0.9511-(1-ppt_y)*0.3090)",
          },
          {
            t: 0.85,
            v: "ppt_y+-0.8500*(ppt_x*-0.8090-(1-ppt_y)*0.5878)",
          },
          {
            t: 0.9,
            v: "ppt_y+-0.9000*(ppt_x*-0.5878-(1-ppt_y)*0.8090)",
          },
          {
            t: 0.95,
            v: "ppt_y+-0.9500*(ppt_x*-0.3090-(1-ppt_y)*0.9511)",
          },
          {
            t: 1,
            v: "ppt_y+-1.0000*(ppt_x*0.0000-(1-ppt_y)*1.0000)",
          },
        ],
      },
    ],
  },
  {
    id: 16, //"split",
    l: "Split",
    r: 4,
    rv: 0,
    pn: "Direction",
    pv: [
      {
        l: "Horizontal In",
        v: 23,
        rv: 19,
      },
      {
        l: "Horizontal Out",
        v: 24,
        rv: 20,
      },
      {
        l: "Vertical In",
        v: 25,
        rv: 19,
      },
      {
        l: "Vertical Out",
        v: 26,
        rv: 20,
      },
    ],
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 1,
        fty: "box",
        sty: "in",
        v: 0,
      },
    ],
  },
  {
    id: 50, // "stretch",
    l: "Stretch",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_w",
        cm: [
          {
            t: 0,
            v: "ppt_w",
          },
          {
            t: 1,
            v: "0",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_h",
        cm: [
          {
            t: 0,
            v: "ppt_h",
          },
          {
            t: 1,
            v: "ppt_h",
          },
        ],
      },
    ],
  },
  {
    id: 18, //"strips",
    l: "Strips",
    r: 22,
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 1,
        fty: "box",
        sty: "in",
        v: 0,
      },
    ],
  },
  {
    id: 19, //"swivel",
    l: "Swivel",
    rv: 0,
    pn: "Direction",
    pv: [
      {
        l: "Horizontal",
        v: 16,
      },
      {
        l: "Vertical",
        v: 17,
      },
    ],
    bh: {
      "16": [
        {
          ty: "props",
          dl: 0,
          du: 5,
          pr: "ppt_h",
          cm: [
            {
              t: 0,
              v: "ppt_h",
            },
            {
              t: 1,
              v: "ppt_h",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 5,
          pr: "ppt_w",
          cm: [
            {
              t: 0,
              v: "ppt_w",
            },
            {
              t: 0.05,
              v: "0.92*ppt_w",
            },
            {
              t: 0.1,
              v: "0.71*ppt_w",
            },
            {
              t: 0.15,
              v: "0.38*ppt_w",
            },
            {
              t: 0.2,
              v: "0",
            },
            {
              t: 0.25,
              v: "-0.38*ppt_w",
            },
            {
              t: 0.3,
              v: "-0.71*ppt_w",
            },
            {
              t: 0.35,
              v: "-0.92*ppt_w",
            },
            {
              t: 0.4,
              v: "-ppt_w",
            },
            {
              t: 0.45,
              v: "-0.92*ppt_w",
            },
            {
              t: 0.5,
              v: "-0.71*ppt_w",
            },
            {
              t: 0.55,
              v: "-0.38*ppt_w",
            },
            {
              t: 0.6,
              v: "0",
            },
            {
              t: 0.65,
              v: "0.38*ppt_w",
            },
            {
              t: 0.7,
              v: "0.71*ppt_w",
            },
            {
              t: 0.75,
              v: "0.92*ppt_w",
            },
            {
              t: 0.8,
              v: "ppt_w",
            },
            {
              t: 0.85,
              v: "0.92*ppt_w",
            },
            {
              t: 0.9,
              v: "0.71*ppt_w",
            },
            {
              t: 0.95,
              v: "0.38*ppt_w",
            },
            {
              t: 1,
              v: "0",
            },
          ],
        },
      ],
      "17": [
        {
          ty: "props",
          dl: 0,
          du: 5,
          pr: "ppt_w",
          cm: [
            {
              t: 0,
              v: "ppt_w",
            },
            {
              t: 1,
              v: "ppt_w",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 5,
          pr: "ppt_h",
          cm: [
            {
              t: 0,
              v: "ppt_h",
            },
            {
              t: 0.05,
              v: "0.92*ppt_h",
            },
            {
              t: 0.1,
              v: "0.71*ppt_h",
            },
            {
              t: 0.15,
              v: "0.38*ppt_h",
            },
            {
              t: 0.2,
              v: "0",
            },
            {
              t: 0.25,
              v: "-0.38*ppt_h",
            },
            {
              t: 0.3,
              v: "-0.71*ppt_h",
            },
            {
              t: 0.35,
              v: "-0.92*ppt_h",
            },
            {
              t: 0.4,
              v: "-ppt_h",
            },
            {
              t: 0.45,
              v: "-0.92*ppt_h",
            },
            {
              t: 0.5,
              v: "-0.71*ppt_h",
            },
            {
              t: 0.55,
              v: "-0.38*ppt_h",
            },
            {
              t: 0.6,
              v: "0",
            },
            {
              t: 0.65,
              v: "0.38*ppt_h",
            },
            {
              t: 0.7,
              v: "0.71*ppt_h",
            },
            {
              t: 0.75,
              v: "0.92*ppt_h",
            },
            {
              t: 0.8,
              v: "ppt_h",
            },
            {
              t: 0.85,
              v: "0.92*ppt_h",
            },
            {
              t: 0.9,
              v: "0.71*ppt_h",
            },
            {
              t: 0.95,
              v: "0.38*ppt_h",
            },
            {
              t: 1,
              v: "0",
            },
          ],
        },
      ],
    },
  },
  {
    id: 20, //"wedge",
    l: "Wedge",
    r: 10,
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 1,
        fty: "pie",
        sty: "in",
        v: 0,
      },
    ],
  },
  {
    id: 21, //"wheel",
    l: "Wheel",
    r: 10,
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 1,
        fty: "pie",
        sty: "in",
        v: 0,
      },
    ],
  },
  {
    id: 22, //"wipe",
    l: "Wipe",
    rv: 0,
    pn: "Direction",
    pv: [
      {
        l: "To Bottom",
        v: 4,
      },
      {
        l: "To Top",
        v: 1,
      },
      {
        l: "To Left",
        v: 8,
      },
      {
        l: "To Right",
        v: 2,
      },
    ],
    bh: {
      4: [
        {
          ty: "filter",
          dl: 0,
          du: 0.5,
          v: 0,
          fty: "wipe",
          sty: "down",
        },
      ],
      2: [
        {
          ty: "filter",
          dl: 0,
          du: 0.5,
          v: 0,
          fty: "wipe",
          sty: "right",
        },
      ],
      1: [
        {
          ty: "filter",
          dl: 0,
          du: 0.5,
          v: 0,
          fty: "wipe",
          sty: "up",
        },
      ],
      8: [
        {
          ty: "filter",
          dl: 0,
          du: 0.5,
          v: 0,
          fty: "wipe",
          sty: "left",
        },
      ],
    },
  },
  {
    id: 23, //"zoom",
    l: "Zoom",
    rv: 0,
    pn: "Direction",
    pv: [
      {
        l: "In",
        v: 19,
      },
      {
        l: "In to Bottom",
        v: 31,
      },
      {
        l: "In Slightly",
        v: 29,
      },
      {
        l: "Out",
        v: 20,
      },
      {
        l: "Out To Center",
        v: 33,
      },
      {
        l: "Out Slightly",
        v: 32,
      },
    ],
    bh: {
      "19": [
        {
          ty: "props",
          dl: 0,
          du: 0.5,
          pr: "ppt_w",
          cm: [
            {
              t: 0,
              v: "ppt_w",
            },
            {
              t: 1,
              v: "4*ppt_w",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 0.5,
          pr: "ppt_h",
          cm: [
            {
              t: 0,
              v: "ppt_h",
            },
            {
              t: 1,
              v: "4*ppt_h",
            },
          ],
        },
      ],
      "20": [
        {
          ty: "props",
          dl: 0,
          du: 0.5,
          pr: "ppt_w",
          cm: [
            {
              t: 0,
              v: "ppt_w",
            },
            {
              t: 1,
              v: "0",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 0.5,
          pr: "ppt_h",
          cm: [
            {
              t: 0,
              v: "ppt_h",
            },
            {
              t: 1,
              v: "0",
            },
          ],
        },
      ],
      "29": [
        {
          ty: "props",
          dl: 0,
          du: 0.5,
          pr: "ppt_w",
          cm: [
            {
              t: 0,
              v: "ppt_w",
            },
            {
              t: 1,
              v: "4/3*ppt_w",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 0.5,
          pr: "ppt_h",
          cm: [
            {
              t: 0,
              v: "ppt_h",
            },
            {
              t: 1,
              v: "4/3*ppt_h",
            },
          ],
        },
      ],
      "31": [
        {
          ty: "props",
          dl: 0,
          du: 0.5,
          pr: "ppt_w",
          cm: [
            {
              t: 0,
              v: "ppt_w",
            },
            {
              t: 1,
              v: "(6*min(max(ppt_w*ppt_h,.3),1)-7.4)/-.7*ppt_w",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 0.5,
          pr: "ppt_h",
          cm: [
            {
              t: 0,
              v: "ppt_h",
            },
            {
              t: 1,
              v: "(6*min(max(ppt_w*ppt_h,.3),1)-7.4)/-.7*ppt_h",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 0.5,
          pr: "ppt_y",
          cm: [
            {
              t: 0,
              v: "ppt_y",
            },
            {
              t: 1,
              v: "1+(6*min(max(ppt_w*ppt_h,.3),1)-7.4)/-.7*ppt_h/2",
            },
          ],
        },
      ],
      "32": [
        {
          ty: "props",
          dl: 0,
          du: 0.5,
          pr: "ppt_w",
          cm: [
            {
              t: 0,
              v: "ppt_w",
            },
            {
              t: 1,
              v: "2/3*ppt_w",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 0.5,
          pr: "ppt_h",
          cm: [
            {
              t: 0,
              v: "ppt_h",
            },
            {
              t: 1,
              v: "2/3*ppt_h",
            },
          ],
        },
      ],
      "33": [
        {
          ty: "props",
          dl: 0,
          du: 0.5,
          pr: "ppt_w",
          cm: [
            {
              t: 0,
              v: "ppt_w",
            },
            {
              t: 1,
              v: "0",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 0.5,
          pr: "ppt_h",
          cm: [
            {
              t: 0,
              v: "ppt_h",
            },
            {
              t: 1,
              v: "0",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 0.5,
          pr: "ppt_x",
          cm: [
            {
              t: 0,
              v: "ppt_x",
            },
            {
              t: 1,
              v: "0.5",
            },
          ],
        },
        {
          ty: "props",
          dl: 0,
          du: 0.5,
          pr: "ppt_y",
          cm: [
            {
              t: 0,
              v: "ppt_y",
            },
            {
              t: 1,
              v: "0.5",
            },
          ],
        },
      ],
    },
  },
  {
    id: 24, // "random",
    l: "Random Effects",
    r: 10,
    rv: 0,
    pn: null,
  },
  {
    id: 25, //"boomerang",
    l: "Boomerang",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        v: 0,
        fty: "fade",
        sty: 0,
      },
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y",
          },
          {
            t: 1,
            v: "#ppt_y+.1",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.5,
        du: 0.5,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y",
          },
          {
            t: 1,
            v: "#ppt_y-.1",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.5,
        du: 0.5,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x",
          },
          {
            t: 1,
            v: "ppt_x+.4",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_h",
        cm: [
          {
            t: 0,
            v: "#ppt_h",
          },
          {
            t: 1,
            v: "#ppt_h",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_w",
        cm: [
          {
            t: 0,
            v: "#ppt_w",
          },
          {
            t: 1,
            v: "#ppt_w*.05",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.5,
        du: 0.5,
        pr: "ppt_w",
        cm: [
          {
            t: 0,
            v: "#ppt_w",
          },
          {
            t: 1,
            v: "#ppt_w/.05",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.5,
        du: 0.5,
        pr: "rotation",
        cm: [
          {
            t: 0,
            v: "0",
          },
          {
            t: 1,
            v: "-90",
          },
        ],
      },
    ],
  },
  {
    id: 26, //"bounce",
    l: "Bounce",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 1.82,
        du: 0.18,
        v: 0,
        fty: "props",
        sty: "down",
      },
      {
        ty: "props",
        dl: 0,
        du: 1.82,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x",
          },
          {
            t: 1,
            v: "#ppt_x+0.25",
          },
        ],
      },
      {
        ty: "props",
        dl: 1.822,
        du: 0.18,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x",
          },
          {
            t: 1,
            v: "#ppt_x",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.66,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y",
          },
          {
            t: 0.05,
            v: "#ppt_y+0.026",
          },
          {
            t: 0.1,
            v: "#ppt_y+0.052",
          },
          {
            t: 0.15,
            v: "#ppt_y+0.078",
          },
          {
            t: 0.2,
            v: "ppt_y+0.103",
          },
          {
            t: 0.3,
            v: "ppt_y+0.151",
          },
          {
            t: 0.4,
            v: "ppt_y+0.196",
          },
          {
            t: 0.5,
            v: "ppt_y+0.236",
          },
          {
            t: 0.6,
            v: "ppt_y+0.270",
          },
          {
            t: 0.7,
            v: "ppt_y+0.297",
          },
          {
            t: 0.8,
            v: "ppt_y+0.317",
          },
          {
            t: 0.9,
            v: "ppt_y+0.329",
          },
          {
            t: 1,
            v: "ppt_y+0.333",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.664,
        du: 0.66,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "ppt_y",
          },
          {
            t: 0.1,
            v: "ppt_y-0.034",
          },
          {
            t: 0.2,
            v: "ppt_y-0.065",
          },
          {
            t: 0.3,
            v: "ppt_y-0.090",
          },
          {
            t: 0.4,
            v: "ppt_y-0.106",
          },
          {
            t: 0.5,
            v: "ppt_y-0.111",
          },
          {
            t: 0.6,
            v: "ppt_y-0.106",
          },
          {
            t: 0.7,
            v: "ppt_y-0.090",
          },
          {
            t: 0.8,
            v: "ppt_y-0.065",
          },
          {
            t: 0.9,
            v: "ppt_y-0.034",
          },
          {
            t: 1,
            v: "ppt_y",
          },
        ],
      },
      {
        ty: "props",
        dl: 1.324,
        du: 0.33,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "ppt_y",
          },
          {
            t: 0.1,
            v: "ppt_y-0.011",
          },
          {
            t: 0.2,
            v: "ppt_y-0.022",
          },
          {
            t: 0.3,
            v: "ppt_y-0.030",
          },
          {
            t: 0.4,
            v: "ppt_y-0.035",
          },
          {
            t: 0.5,
            v: "ppt_y-0.037",
          },
          {
            t: 0.6,
            v: "ppt_y-0.035",
          },
          {
            t: 0.7,
            v: "ppt_y-0.030",
          },
          {
            t: 0.8,
            v: "ppt_y-0.022",
          },
          {
            t: 0.9,
            v: "ppt_y-0.011",
          },
          {
            t: 1,
            v: "ppt_y",
          },
        ],
      },
      {
        ty: "props",
        dl: 1.656,
        du: 0.16,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "ppt_y",
          },
          {
            t: 0.1,
            v: "ppt_y-0.004",
          },
          {
            t: 0.2,
            v: "ppt_y-0.007",
          },
          {
            t: 0.3,
            v: "ppt_y-0.010",
          },
          {
            t: 0.4,
            v: "ppt_y-0.012",
          },
          {
            t: 0.5,
            v: "ppt_y-0.0123",
          },
          {
            t: 0.6,
            v: "ppt_y-0.012",
          },
          {
            t: 0.7,
            v: "ppt_y-0.010",
          },
          {
            t: 0.8,
            v: "ppt_y-0.007",
          },
          {
            t: 0.9,
            v: "ppt_y-0.004",
          },
          {
            t: 1,
            v: "ppt_y",
          },
        ],
      },
      {
        ty: "props",
        dl: 1.82,
        du: 0.18,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "ppt_y",
          },
          {
            t: 1,
            v: "ppt_y+ppt_h",
          },
        ],
      },
      {
        ty: "scaleto",
        dl: 0.62,
        du: 0.03,
        fromX: 0,
        toX: 100,
        fromY: 0,
        toY: 60,
      },
      {
        ty: "scaleto",
        dl: 0.646,
        du: 0.17,
        fromX: 0,
        toX: 100,
        fromY: 0,
        toY: 100,
      },
      {
        ty: "scaleto",
        dl: 1.312,
        du: 0.03,
        fromX: 0,
        toX: 100,
        fromY: 0,
        toY: 80,
      },
      {
        ty: "scaleto",
        dl: 1.338,
        du: 0.17,
        fromX: 0,
        toX: 100,
        fromY: 0,
        toY: 100,
      },
      {
        ty: "scaleto",
        dl: 1.642,
        du: 0.03,
        fromX: 0,
        toX: 100,
        fromY: 0,
        toY: 90,
      },
      {
        ty: "scaleto",
        dl: 1.668,
        du: 0.17,
        fromX: 0,
        toX: 100,
        fromY: 0,
        toY: 100,
      },
      {
        ty: "scaleto",
        dl: 1.808,
        du: 0.03,
        fromX: 0,
        toX: 100,
        fromY: 0,
        toY: 95,
      },
      {
        ty: "scaleto",
        dl: 1.834,
        du: 0.17,
        fromX: 0,
        toX: 100,
        fromY: 0,
        toY: 100,
      },
    ],
  },
  {
    id: 27, //"colortypewriter",
    l: "Color Typewriter",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 0.08,
        pr: 0,
        cm: [
          {
            t: 0,
            v: "",
          },
          {
            t: 0.5,
            v: "",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.08,
        pr: 0,
        cm: [
          {
            t: 0,
            v: "",
          },
          {
            t: 0.5,
            v: "",
          },
        ],
      },
    ],
  },
  {
    id: 28, //"credits",
    l: "Credits",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 15,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x",
          },
          {
            t: 1,
            v: "#ppt_x",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 15,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y-1",
          },
          {
            t: 1,
            v: "#ppt_y+1",
          },
        ],
      },
    ],
  },
  {
    id: 29, //"ease",
    l: "Ease Out",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x",
          },
          {
            t: 1,
            v: "#ppt_x-.2",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y",
          },
          {
            t: 1,
            v: "#ppt_y",
          },
        ],
      },
      {
        ty: "filter",
        dl: 0,
        du: 1,
        v: 0,
        fty: "fade",
        sty: 0,
      },
    ],
  },
  {
    id: 30, //"float",
    l: "Float",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0.2,
        du: 0.8,
        v: 0,
        fty: "fade",
        sty: 0,
      },
      {
        ty: "props",
        dl: 0.2,
        du: 0.8,
        pr: "rotation",
        cm: [
          {
            t: 0,
            v: "0",
          },
          {
            t: 1,
            v: "-90",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.2,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "ppt_x",
          },
          {
            t: 1,
            v: "#ppt_x-0.05",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.2,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y",
          },
          {
            t: 1,
            v: "#ppt_y+0.1",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.2,
        du: 0.8,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "ppt_x",
          },
          {
            t: 1,
            v: "#ppt_x+0.4+0.05",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.2,
        du: 0.8,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y",
          },
          {
            t: 1,
            v: "#ppt_y-0.4-0.1",
          },
        ],
      },
    ],
  },
  {
    id: 31, //"growandturn",
    l: "Grow And Turn",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_w",
        cm: [
          {
            t: 0,
            v: "#ppt_w",
          },
          {
            t: 1,
            v: "0",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_h",
        cm: [
          {
            t: 0,
            v: "#ppt_h",
          },
          {
            t: 1,
            v: "0",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "rotation",
        cm: [
          {
            t: 0,
            v: "0",
          },
          {
            t: 1,
            v: "90",
          },
        ],
      },
      {
        ty: "filter",
        dl: 0,
        du: 1,
        v: 0,
        fty: "fade",
        sty: 0,
      },
    ],
  },
  {
    id: 34, //"lightspeed",
    l: "Light Speed",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "(#ppt_x)",
          },
          {
            t: 1,
            v: "(#ppt_x+1)",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.2,
        pr: 24,
        cm: [
          {
            t: 0,
            v: "(#ppt_x)",
          },
          {
            t: 1,
            v: "-1.0",
          },
        ],
      },
    ],
  },
  {
    id: 35, //"pinwheel",
    l: "Pinwheel",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        v: 0,
        fty: "fade",
        sty: 0,
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "rotation",
        cm: [
          {
            t: 0,
            v: "0",
          },
          {
            t: 1,
            v: "720",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_h",
        cm: [
          {
            t: 0,
            v: "ppt_h",
          },
          {
            t: 1,
            v: "0",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_w",
        cm: [
          {
            t: 0,
            v: "ppt_w",
          },
          {
            t: 1,
            v: "0",
          },
        ],
      },
    ],
  },
  {
    id: 37, //"sink",
    l: "Rise Down",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        v: 0,
        fty: "fade",
        sty: 0,
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x",
          },
          {
            t: 1,
            v: "#ppt_x",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.1,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y",
          },
          {
            t: 1,
            v: "#ppt_y-.03",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.1,
        du: 0.9,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y",
          },
          {
            t: 1,
            v: "#ppt_y+1",
          },
        ],
      },
    ],
  },
  {
    id: 38, //"swish",
    l: "Swish",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "rotation",
        cm: [
          {
            t: 0,
            v: "0",
          },
          {
            t: 1,
            v: "45",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "ppt_y",
          },
          {
            t: 1,
            v: "ppt_y+1",
          },
        ],
      },
    ],
  },
  {
    id: 39, //"thread",
    l: "Thread",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_h",
        cm: [
          {
            t: 0,
            v: "#ppt_h",
          },
          {
            t: 0.5,
            v: "#ppt_h/20",
          },
          {
            t: 1,
            v: "#ppt_h/20",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_w",
        cm: [
          {
            t: 0,
            v: "ppt_w",
          },
          {
            t: 0.5,
            v: "#ppt_w+.3",
          },
          {
            t: 1,
            v: "#ppt_w+.3",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x",
          },
          {
            t: 0.5,
            v: "#ppt_x",
          },
          {
            t: 1,
            v: "#ppt_x-.3",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y",
          },
          {
            t: 1,
            v: "#ppt_y",
          },
        ],
      },
    ],
  },
  {
    id: 40, //"fold",
    l: "Unfold",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        v: 0,
        fty: "fade",
        sty: 0,
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x",
          },
          {
            t: 1,
            v: "#ppt_x-.1",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y",
          },
          {
            t: 1,
            v: "#ppt_y",
          },
        ],
      },
    ],
  },
  {
    id: 41, //"whip",
    l: "Whip",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x",
          },
          {
            t: 0.5,
            v: "#ppt_x+.1",
          },
          {
            t: 1,
            v: "#ppt_x",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y",
          },
          {
            t: 1,
            v: "#ppt_y",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_h",
        cm: [
          {
            t: 0,
            v: "#ppt_h",
          },
          {
            t: 0.5,
            v: "#ppt_h+.01",
          },
          {
            t: 1,
            v: "#ppt_h/10",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_w",
        cm: [
          {
            t: 0,
            v: "#ppt_w",
          },
          {
            t: 0.5,
            v: "#ppt_w+.01",
          },
          {
            t: 1,
            v: "#ppt_w/10",
          },
        ],
      },
      {
        ty: "filter",
        dl: 0,
        du: 0.5,
        v: 0,
        fty: "fade",
        sty: 0,
      },
    ],
  },
  {
    id: 42, //"descend",
    l: "Descend",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        v: 0,
        fty: "fade",
        sty: 0,
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x",
          },
          {
            t: 1,
            v: "#ppt_x",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y",
          },
          {
            t: 1,
            v: "#ppt_y+.1",
          },
        ],
      },
    ],
  },
  {
    id: 47,
    l: "Ascend",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        v: 0,
        fty: "fade",
        sty: 0,
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x",
          },
          {
            t: 1,
            v: "#ppt_x",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y",
          },
          {
            t: 1,
            v: "#ppt_y+.1",
          },
        ],
      },
    ],
  },
  {
    id: 43, //"centerrevolve",
    l: "Center Revolve",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 0.6,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "ppt_x",
          },
          {
            t: 0.05,
            v: "ppt_x+0.0242",
          },
          {
            t: 0.1,
            v: "ppt_x+0.0479",
          },
          {
            t: 0.15,
            v: "ppt_x+0.0704",
          },
          {
            t: 0.2,
            v: "ppt_x+0.0911",
          },
          {
            t: 0.25,
            v: "ppt_x+0.1096",
          },
          {
            t: 0.3,
            v: "ppt_x+0.1254",
          },
          {
            t: 0.35,
            v: "ppt_x+0.1381",
          },
          {
            t: 0.4,
            v: "ppt_x+0.1474",
          },
          {
            t: 0.45,
            v: "ppt_x+0.1531",
          },
          {
            t: 0.5,
            v: "ppt_x+0.155",
          },
          {
            t: 0.55,
            v: "ppt_x+0.1531",
          },
          {
            t: 0.6,
            v: "ppt_x+0.1474",
          },
          {
            t: 0.65,
            v: "ppt_x+0.1381",
          },
          {
            t: 0.7,
            v: "ppt_x+0.1254",
          },
          {
            t: 0.75,
            v: "ppt_x+0.1096",
          },
          {
            t: 0.8,
            v: "ppt_x+0.0911",
          },
          {
            t: 0.85,
            v: "ppt_x+0.0704",
          },
          {
            t: 0.9,
            v: "ppt_x+0.0479",
          },
          {
            t: 0.95,
            v: "ppt_x+0.0242",
          },
          {
            t: 1,
            v: "ppt_x",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.6,
        du: 0.4,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "ppt_x",
          },
          {
            t: 1,
            v: "ppt_x",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.6,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "ppt_y",
          },
          {
            t: 0.05,
            v: "ppt_y+0.0019",
          },
          {
            t: 0.1,
            v: "ppt_y+0.0076",
          },
          {
            t: 0.15,
            v: "ppt_y+0.0169",
          },
          {
            t: 0.2,
            v: "ppt_y+0.0296",
          },
          {
            t: 0.25,
            v: "ppt_y+0.0454",
          },
          {
            t: 0.3,
            v: "ppt_y+0.0639",
          },
          {
            t: 0.35,
            v: "ppt_y+0.0846",
          },
          {
            t: 0.4,
            v: "ppt_y+0.1071",
          },
          {
            t: 0.45,
            v: "ppt_y+0.1307",
          },
          {
            t: 0.5,
            v: "ppt_y+0.155",
          },
          {
            t: 0.55,
            v: "ppt_y+0.1792",
          },
          {
            t: 0.6,
            v: "ppt_y+0.2029",
          },
          {
            t: 0.65,
            v: "ppt_y+0.2253",
          },
          {
            t: 0.7,
            v: "ppt_y+0.2461",
          },
          {
            t: 0.75,
            v: "ppt_y+0.2646",
          },
          {
            t: 0.8,
            v: "ppt_y+0.2804",
          },
          {
            t: 0.85,
            v: "ppt_y+0.2931",
          },
          {
            t: 0.9,
            v: "ppt_y+0.3024",
          },
          {
            t: 0.95,
            v: "ppt_y+0.308",
          },
          {
            t: 1,
            v: "ppt_y+0.31",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.6,
        du: 0.4,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "ppt_y",
          },
          {
            t: 1,
            v: "ppt_y",
          },
        ],
      },
      {
        ty: "filter",
        dl: 0.9,
        du: 0.1,
        v: 0,
        fty: "fade",
        sty: 0,
      },
    ],
  },
  {
    id: 45, //"fadedrevolve",
    l: "Faded Swivel",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        v: 0,
        fty: "fade",
        sty: 0,
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_w",
        cm: [
          {
            t: 0,
            v: "#ppt_w",
          },
          {
            t: 0.05,
            v: "0.92*#ppt_w",
          },
          {
            t: 0.1,
            v: "0.71*#ppt_w",
          },
          {
            t: 0.15,
            v: "0.38*ppt_w",
          },
          {
            t: 0.2,
            v: "0",
          },
          {
            t: 0.25,
            v: "-0.38*#ppt_w",
          },
          {
            t: 0.3,
            v: "-0.71*#ppt_w",
          },
          {
            t: 0.35,
            v: "-0.92*#ppt_w",
          },
          {
            t: 0.4,
            v: "-#ppt_w",
          },
          {
            t: 0.45,
            v: "-0.92*ppt_w",
          },
          {
            t: 0.5,
            v: "-0.71*ppt_w",
          },
          {
            t: 0.55,
            v: "-0.38*ppt_w",
          },
          {
            t: 0.6,
            v: "0",
          },
          {
            t: 0.65,
            v: "0.38*ppt_w",
          },
          {
            t: 0.7,
            v: "0.71*ppt_w",
          },
          {
            t: 0.75,
            v: "0.92*ppt_w",
          },
          {
            t: 0.8,
            v: "ppt_w",
          },
          {
            t: 0.85,
            v: "0.92*ppt_w",
          },
          {
            t: 0.9,
            v: "0.71*ppt_w",
          },
          {
            t: 0.95,
            v: "0.38*ppt_w",
          },
          {
            t: 1,
            v: "0",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_h",
        cm: [
          {
            t: 0,
            v: "ppt_h",
          },
          {
            t: 1,
            v: "ppt_h",
          },
        ],
      },
    ],
  },
  {
    id: 42, //"descend",
    l: "Descend",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        v: 0,
        fty: "fade",
        sty: 0,
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x",
          },
          {
            t: 1,
            v: "#ppt_x",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y",
          },
          {
            t: 1,
            v: "#ppt_y-.1",
          },
        ],
      },
    ],
  },
  {
    id: 48, //"sling",
    l: "Sling",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "rotation",
        cm: [
          {
            t: 0,
            v: "0",
          },
          {
            t: 0.2,
            v: "90",
          },
          {
            t: 0.2,
            v: "90",
          },
          {
            t: 1,
            v: "90",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x",
          },
          {
            t: 0.5,
            v: "0.95",
          },
          {
            t: 1,
            v: "-1",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y",
          },
          {
            t: 1,
            v: "#ppt_y",
          },
        ],
      },
      {
        ty: "filter",
        dl: 0,
        du: 1,
        v: 0,
        fty: "fade",
        sty: 0,
      },
    ],
  },
  {
    id: 49, //"spinner",
    l: "Spinner",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_w",
        cm: [
          {
            t: 0,
            v: "ppt_w",
          },
          {
            t: 1,
            v: "0",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_h",
        cm: [
          {
            t: 0,
            v: "ppt_h",
          },
          {
            t: 1,
            v: "0",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "rotation",
        cm: [
          {
            t: 0,
            v: "0",
          },
          {
            t: 1,
            v: "360",
          },
        ],
      },
      {
        ty: "filter",
        dl: 0,
        du: 0.5,
        v: 0,
        fty: "fade",
        sty: 0,
      },
      {
        ty: "set",
        dl: 0.499,
        du: 0,
        cm: "visibility",
        v: "0",
      },
    ],
  },
  {
    id: 17, //"compress",
    l: "Collapse",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_w",
        cm: [
          {
            t: 0,
            v: "ppt_w",
          },
          {
            t: 1,
            v: "ppt_w+.3",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_h",
        cm: [
          {
            t: 0,
            v: "ppt_h",
          },
          {
            t: 1,
            v: "ppt_h",
          },
        ],
      },
      {
        ty: "filter",
        dl: 0,
        du: 1,
        v: 0,
        fty: "fade",
        sty: 0,
      },
    ],
  },
  {
    id: 51, //"magnify",
    l: "Magnify",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 1.23,
        du: 0.77,
        v: 0,
        fty: "fade",
        sty: 0,
      },
      {
        ty: "scaleto",
        dl: 1.23,
        du: 0.77,
        fromX: 200,
        toX: 10,
        fromY: 450,
        toY: 10,
      },
      {
        ty: "scaleto",
        dl: 0,
        du: 1.23,
        fromX: 100,
        toX: 200,
        fromY: 100,
        toY: 450,
      },
      {
        ty: "props",
        dl: 0,
        du: 1.23,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "(#ppt_x)",
          },
          {
            t: 1,
            v: "(0.5)",
          },
        ],
      },
      {
        ty: "props",
        dl: 1.23,
        du: 0.77,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "(0.5)",
          },
          {
            t: 1,
            v: "(0.5)",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1.23,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "(#ppt_y)",
          },
          {
            t: 1,
            v: "(#ppt_y+0.4)",
          },
        ],
      },
      {
        ty: "props",
        dl: 1.23,
        du: 0.77,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "(#ppt_y)",
          },
          {
            t: 1,
            v: "(#ppt_y)",
          },
        ],
      },
    ],
  },
  {
    id: 52,
    l: "Curve Down",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "scaleto",
        dl: 0,
        du: 1,
        fromX: 100,
        toX: 250,
        fromY: 100,
        toY: 250,
      },
      {
        ty: "motion",
        dl: 0,
        du: 1,
        cm: [
          {
            c: "M",
            p: [0, 0],
          },
          {
            c: "C",
            p: [27.37, 0, 103.75, 12.64, 131.47, 49.41],
          },
          {
            c: "C",
            p: [159.25, 86.21, 177.88, 168.78, 166.9, 220.48],
          },
          {
            c: "C",
            p: [155.87, 272.13, 149.38, 312.92, 65.38, 359.69],
          },
          {
            c: "C",
            p: [-18.37, 406.51, -270.12, 477.94, -336.53, 501.61],
          },
        ],
      },
      {
        ty: "filter",
        dl: 0,
        du: 1,
        v: 0,
        fty: "fade",
        sty: 0,
      },
    ],
  },
  {
    id: 53, //"fadedzoom",
    l: "Faded Zoom",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_w",
        cm: [
          {
            t: 0,
            v: "ppt_w",
          },
          {
            t: 1,
            v: "0",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_h",
        cm: [
          {
            t: 0,
            v: "ppt_h",
          },
          {
            t: 1,
            v: "0",
          },
        ],
      },
      {
        ty: "filter",
        dl: 0,
        du: 0.5,
        v: 0,
        fty: "fade",
        sty: 0,
      },
    ],
  },
  {
    id: 54, //"glide",
    l: "Glide",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_w",
        cm: [
          {
            t: 0,
            v: "ppt_w",
          },
          {
            t: 1,
            v: "ppt_w*0.05",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_h",
        cm: [
          {
            t: 0,
            v: "ppt_h",
          },
          {
            t: 1,
            v: "ppt_h",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x",
          },
          {
            t: 1,
            v: "#ppt_x-.2",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y",
          },
          {
            t: 1,
            v: "#ppt_y",
          },
        ],
      },
      {
        ty: "filter",
        dl: 0,
        du: 0.5,
        v: 0,
        fty: "fade",
        sty: 0,
      },
    ],
  },
  {
    id: 55, //"contrast",
    l: "Contract",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_w",
        cm: [
          {
            t: 0,
            v: "ppt_w",
          },
          {
            t: 1,
            v: "ppt_w*0.70",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_h",
        cm: [
          {
            t: 0,
            v: "ppt_h",
          },
          {
            t: 1,
            v: "ppt_h",
          },
        ],
      },
      {
        ty: "filter",
        dl: 0,
        du: 1,
        v: 0,
        fty: "fade",
        sty: 0,
      },
    ],
  },
  {
    id: 56, //"flip",
    l: "Flip",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_w",
        cm: [
          {
            t: 0,
            v: "(ppt_w)",
          },
          {
            t: 1,
            v: "(-ppt_w*2)",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x",
          },
          {
            t: 1,
            v: "#ppt_x",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 1,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "(#ppt_y)",
          },
          {
            t: 1,
            v: "(1+ppt_h/2)",
          },
        ],
      },
      {
        ty: "rotation",
        dl: 0,
        du: 1,
        by: 360,
      },
    ],
  },
  {
    id: 58,
    l: "Fold",
    re: 0,
    pn: null,
    bh: [
      {
        ty: "props",
        sp: 1,
        dl: 0,
        du: 0.5,
        pr: "ppt_w",
        cm: [
          { t: 0, v: "ppt_w" },
          { t: 1, v: "ppt_w*2.5" },
        ],
      },
      {
        ty: "props",
        sp: 1,
        dl: 0,
        du: 0.5,
        pr: "ppt_h",
        cm: [
          { t: 0, v: "ppt_h" },
          { t: 1, v: "ppt_h*0.01" },
        ],
      },
      {
        ty: "props",
        sp: 1,
        dl: 0,
        du: 0.5,
        pr: "ppt_x",
        cm: [
          { t: 0, v: "#ppt_x" },
          { t: 1, v: "#ppt_x" },
        ],
      },
      {
        ty: "props",
        sp: 1,
        dl: 0,
        du: 0.5,
        pr: "ppt_y",
        cm: [
          { t: 0, v: "#ppt_y" },
          { t: 1, v: "ppt_h+1" },
        ],
      },
      { ty: "filter", sp: 1, dl: 0, du: 0.5, re: 0, fty: "fade", sty: 0 },
    ],
  },
];
