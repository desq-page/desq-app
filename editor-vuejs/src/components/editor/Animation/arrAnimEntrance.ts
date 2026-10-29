export const arrAnimEntrance = [
  {
    id: 1,
    l: "Appear",
    rv: 0,
    pn: null,
    bh: [],
  },
  {
    id: 2,
    l: "Fly In",
    rv: 0,
    pn: "Direction",
    pv: [
      {
        l: "From Bottom",
        v: 3,
      },
      {
        l: "From Left",
        v: 4,
      },
      {
        l: "From Right",
        v: 2,
      },
      {
        l: "From Top",
        v: 1,
      },
      {
        l: "From Bottom-Left",
        v: 9,
      },
      {
        l: "From Bottom-Right",
        v: 8,
      },
      {
        l: "From Top-Left",
        v: 6,
      },
      {
        l: "From Top-Right",
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
              v: "0-#ppt_h/2",
            },
            {
              t: 1,
              v: "#ppt_y",
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
              v: "1+#ppt_w/2",
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
              v: "#ppt_y",
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
              v: "1+#ppt_h/2",
            },
            {
              t: 1,
              v: "#ppt_y",
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
              v: "0-#ppt_w/2",
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
              v: "#ppt_y",
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
              v: "0-#ppt_w/2",
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
              v: "0-#ppt_h/2",
            },
            {
              t: 1,
              v: "#ppt_y",
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
              v: "1+#ppt_w/2",
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
              v: "0-#ppt_h/2",
            },
            {
              t: 1,
              v: "#ppt_y",
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
              v: "1+#ppt_w/2",
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
              v: "1+#ppt_h/2",
            },
            {
              t: 1,
              v: "#ppt_y",
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
              v: "0-#ppt_w/2",
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
              v: "1+#ppt_h/2",
            },
            {
              t: 1,
              v: "#ppt_y",
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
        v: "horizontal",
        rv: 0,
      },
      {
        l: "Vertical",
        v: "vertical",
        rv: 2,
      },
    ],
    bh: {
      horizontal: [
        {
          ty: "filter",
          sp: 1,
          dl: 0,
          du: 0.5,
          fty: "blinds",
          sty: "horizontal",
          rw: 0,
          re: 1,
        },
      ],
      vertical: [
        {
          ty: "filter",
          sp: 1,
          dl: 0,
          du: 0.5,
          fty: "blinds",
          sty: "vertical",
          rw: 0,
          re: 1,
        },
      ],
    },
  },
  {
    id: 4, //"box",
    l: "Box",
    rv: 0,
    pn: "Direction",
    pv: [
      {
        l: "In",
        v: "in",
      },
      {
        l: "Out",
        v: "out",
      },
    ],
    bh: {
      in: [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
          fty: "box",
          sty: "in",
        },
      ],
      out: [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
          fty: "box",
          sty: "out",
        },
      ],
    },
  },
  {
    id: 5, //"checkboard",
    l: "Checkerboard",
    r: 22,
    rv: 0,
    pn: "Direction",
    pv: [
      {
        l: "Horizontal",
        v: "horizontal",
        rv: 0,
      },
      {
        l: "Vertical",
        v: "vertical",
        rv: 2,
      },
    ],
    bh: {
      horizontal: [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
          fty: "checkerboard",
          sty: "horizontal",
        },
      ],
      vertical: [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
          fty: "checkerboard",
          sty: "vertical",
        },
      ],
    },
  },
  {
    id: 6, //"circle",
    l: "Circle",
    r: 4,
    rv: 0,
    pn: null,
    pv: [
      {
        l: "In",
        v: "in",
      },
      {
        l: "Out",
        v: "out",
      },
    ],
    bh: {
      in: [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
          fty: "circle",
          sty: "in",
        },
      ],
      out: [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
          fty: "circle",
          sty: "out",
        },
      ],
    }
  },
  {
    id: 7, //"crawl",
    l: "Crawl In",
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
    pv: [
      {
        l: "In",
        v: "in",
      },
      {
        l: "Out",
        v: "out",
      },
    ],
    bh: {
      in: [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
          fty: "diamond",
          sty: "in",
        },
      ],
      out: [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
          fty: "diamond",
          sty: "out",
        },
      ],
    }
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
    l: "Fade",
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
        ty: "set",
        dl: 0,
        du: 1,
        cm: "visibility",
        v: "1",
      },
    ],
  },
  {
    id: 12, //"peek",
    l: "Peek In",
    rv: 0,
    pn: "Direction",
    pv: [
      {
        l: "From Top",
        v: "fromTop",
      },
      {
        l: "From Left",
        v: "fromLeft",
      },
      {
        l: "From Right",
        v: "fromRight",
      },
      {
        l: "From Bottom",
        v: "fromBottom",
      },
    ],
    bh: {
      "fromBottom": [
        {
          ty: "filter",
          dl: 0,
          du: 0.5,
          rv: 0,
          fty: "slide",
          sty: "fromBottom",
        },
      ],
      "fromRight": [
        {
          ty: "filter",
          dl: 0,
          du: 0.5,
          rv: 0,
          fty: "slide",
          sty: "fromRight",
        },
      ],
      "fromTop": [
        {
          ty: "filter",
          dl: 0,
          du: 0.5,
          rv: 0,
          fty: "slide",
          sty: "fromTop",
        },
      ],
      "fromLeft": [
        {
          ty: "filter",
          dl: 0,
          du: 0.5,
          rv: 0,
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
    pv: [
      {
        l: "In",
        v: "in",
      },
      {
        l: "Out",
        v: "out",
      },
    ],
    bh: {
      in: [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
          fty: "plus",
          sty: "in",
        },
      ],
      out: [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
          fty: "plus",
          sty: "out",
        },
      ],
    }
  },
  {
    id: 14, //"randombars",
    l: "Random Bars",
    r: 10,
    rv: 0,
    pn: null,
  },
  {
    id: 15, //"spiral",
    l: "Spiral In",
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
            v: "0",
          },
          {
            t: 1,
            v: "#ppt_w",
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
            v: "0",
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
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            f: "#ppt_x+(cos(-2*pi*(1-$))*-#ppt_x-sin(-2*pi*(1-$))*(1-#ppt_y))*(1-$)",
          },
          {
            t: 1,
            v: "1",
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
            f: "#ppt_y+(sin(-2*pi*(1-$))*-#ppt_x+cos(-2*pi*(1-$))*(1-#ppt_y))*(1-$)",
          },
          {
            t: 1,
            v: "1",
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
        v: "inHorizontal",
      },
      {
        l: "Horizontal Out",
        v: "outHorizontal",
      },
      {
        l: "Vertical In",
        v: "inVertical",
      },
      {
        l: "Vertical Out",
        v: "outHorizontal",
      },
    ],
    bh: {
      inHorizontal: [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
          fty: "barn",
          sty: "inHorizontal",
        },
      ],
      outHorizontal: [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
          fty: "barn",
          sty: "outHorizontal",
        },
      ],
      inVertical: [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
          fty: "barn",
          sty: "inVertical",
        },
      ],
      outVertical: [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
          fty: "barn",
          sty: "outVertical",
        },
      ],
    }
  },
  {
    id: 17, //"stretch",
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
            v: "0",
          },
          {
            t: 1,
            v: "#ppt_w",
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
            t: 1,
            v: "#ppt_h",
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
        rv: 0,
        fty: "box",
        sty: "in",
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
          du: 0.5,
          pr: "ppt_w",
          cm: [
            {
              t: 0,
              f: "#ppt_w*sin(2.5*pi*$)",
            },
            {
              t: 1,
              v: "1",
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
              t: 1,
              v: "#ppt_h",
            },
          ],
        },
      ],
      "17": [
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
              v: "#ppt_w",
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
              f: "#ppt_h*sin(2.5*pi*$)",
            },
            {
              t: 1,
              v: "1",
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
        rv: 0,
        fty: "pie",
        sty: "in",
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
        rv: 0,
        fty: "pie",
        sty: "in",
      },
    ],
  },
  {
    id: 22, // "wipe",
    l: "Wipe",
    rv: 0,
    pn: "Direction",
    pv: [
      {
        l: "From Bottom",
        v: 4,
      },
      {
        l: "From Left",
        v: 8,
      },
      {
        l: "From Right",
        v: 2,
      },
      {
        l: "From Top",
        v: 1,
      },
    ],
    bh: {
      "1": [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
          fty: "wipe",
          sty: "up",
        },
      ],
      "2": [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
          fty: "wipe",
          sty: "right",
        },
      ],
      "4": [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
          fty: "wipe",
          sty: "down",
        },
      ],
      "8": [
        {
          ty: "filter",
          dl: 0,
          du: 1,
          rv: 0,
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
        l: "In From Center",
        v: 30,
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
        l: "Out From Center",
        v: 34,
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
              v: "0",
            },
            {
              t: 1,
              v: "#ppt_w",
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
              v: "0",
            },
            {
              t: 1,
              v: "#ppt_h",
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
              v: "4*#ppt_w",
            },
            {
              t: 1,
              v: "#ppt_w",
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
              v: "4*#ppt_h",
            },
            {
              t: 1,
              v: "#ppt_h",
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
              v: "2/3*#ppt_w",
            },
            {
              t: 1,
              v: "#ppt_w",
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
              v: "2/3*#ppt_h",
            },
            {
              t: 1,
              v: "#ppt_h",
            },
          ],
        },
      ],
      "30": [
        {
          ty: "props",
          dl: 0,
          du: 0.5,
          pr: "ppt_w",
          cm: [
            {
              t: 0,
              v: "0",
            },
            {
              t: 1,
              v: "#ppt_w",
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
              v: "0",
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
          pr: "ppt_x",
          cm: [
            {
              t: 0,
              v: "0.5",
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
              v: "0.5",
            },
            {
              t: 1,
              v: "#ppt_y",
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
              v: "4/3*#ppt_w",
            },
            {
              t: 1,
              v: "#ppt_w",
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
              v: "4/3*#ppt_h",
            },
            {
              t: 1,
              v: "#ppt_h",
            },
          ],
        },
      ],
      "34": [
        {
          ty: "props",
          dl: 0,
          du: 0.5,
          pr: "ppt_w",
          cm: [
            {
              t: 0,
              v: "(6*min(max(#ppt_w*#ppt_h,.3),1)-7.4)/-.7*#ppt_w",
            },
            {
              t: 1,
              v: "#ppt_w",
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
              v: "(6*min(max(#ppt_w*#ppt_h,.3),1)-7.4)/-.7*#ppt_h",
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
          pr: "ppt_x",
          cm: [
            {
              t: 0,
              v: "0.5",
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
              v: "1+(6*min(max(#ppt_w*#ppt_h,.3),1)-7.4)/-.7*#ppt_h/2",
            },
            {
              t: 1,
              v: "#ppt_y",
            },
          ],
        },
      ],
    },
  },
  {
    id: 24, //"random",
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
        ty: "props",
        dl: 0,
        du: 0.5,
        pr: "rotation",
        cm: [
          {
            t: 0,
            v: "-90",
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
            v: "#ppt_w*.05",
          },
          {
            t: 1,
            v: "#ppt_w",
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
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x+.4",
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
            v: "#ppt_y-.2",
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
            v: "#ppt_y+.1",
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
        rv: 0,
        fty: "fade",
        sty: 0,
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
        dl: 0,
        du: 0.58,
        rv: 0,
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
            v: "#ppt_x-0.25",
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
            f: "#ppt_y-sin(pi*$)/3",
          },
          {
            t: 1,
            v: "1",
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
            f: "#ppt_y-sin(pi*$)/9",
          },
          {
            t: 1,
            v: "1",
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
            f: "#ppt_y-sin(pi*$)/27",
          },
          {
            t: 1,
            v: "1",
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
            f: "#ppt_y-sin(pi*$)/81",
          },
          {
            t: 1,
            v: "1",
          },
        ],
      },
      {
        ty: "scaleto",
        dl: 0.65,
        du: 0.03,
        fromX: 0,
        toX: 100,
        fromY: 0,
        toY: 60,
      },
      {
        ty: "scaleto",
        dl: 0.676,
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
        hold: true,
      },
      {
        ty: "props",
        dl: 0,
        du: 15,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y+1",
          },
          {
            t: 1,
            v: "#ppt_y-1",
          },
        ],
        hold: true,
      },
    ],
  },
  {
    id: 29, //"ease",
    l: "Ease In",
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
            v: "#ppt_x-.2",
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
            v: "#ppt_y",
          },
        ],
      },
      {
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 0,
        fty: "props",
        sty: "right",
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
        dl: 0,
        du: 0.8,
        rv: 0,
        fty: "fade",
        sty: 0,
      },
      {
        ty: "props",
        dl: 0,
        du: 0.8,
        pr: "rotation",
        cm: [
          {
            t: 0,
            v: "-90",
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
        du: 0.8,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x+0.4",
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
        du: 0.8,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y-0.4",
          },
          {
            t: 1,
            v: "#ppt_y+0.1",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.8,
        du: 0.2,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x-0.05",
          },
          {
            t: 1,
            v: "#ppt_x",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.8,
        du: 0.2,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y+0.1",
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
    id: 31, // "growandturn",
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
            v: "0",
          },
          {
            t: 1,
            v: "#ppt_w",
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
            v: "0",
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
        du: 1,
        pr: "rotation",
        cm: [
          {
            t: 0,
            v: "90",
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
        du: 1,
        rv: 0,
        fty: "fade",
        sty: 0,
      },
    ],
  },
  {
    id: 34, // "lightspeed",
    l: "Light Speed",
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
            v: "(-#ppt_w/2)",
          },
          {
            t: 1,
            v: "(#ppt_x)",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.6,
        du: 0.2,
        pr: 24,
        cm: [
          {
            t: 0,
            v: "(-#ppt_w/2)",
          },
          {
            t: 1,
            v: "-1.0",
          },
        ],
      },
      {
        ty: "scaleto",
        dl: 0.6,
        du: 0.2,
        fromX: 100,
        toX: 80,
        fromY: 100,
        toY: 100,
      },
      {
        ty: "props",
        dl: 0.6,
        du: 0.2,
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
        rv: 0,
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
            v: "720",
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
            v: "0",
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
        du: 1,
        pr: "ppt_w",
        cm: [
          {
            t: 0,
            v: "0",
          },
          {
            t: 1,
            v: "#ppt_w",
          },
        ],
      },
    ],
  },
  {
    id: 37, //"risesink",
    l: "Rise Up",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 0,
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
        du: 0.9,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y+1",
          },
          {
            t: 1,
            v: "#ppt_y-.03",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.9,
        du: 0.1,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y-.03",
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
    id: 38, //"swish",
    l: "Swish",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "set",
        dl: 0,
        du: 0.46,
        cm: 16,
        v: "-45.0",
      },
      {
        ty: "props",
        dl: 0.455,
        du: 0.46,
        pr: "rotation",
        cm: [
          {
            t: 0,
            v: "-45",
          },
          {
            t: 0.699,
            v: "45",
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
        du: 0.46,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y-1",
          },
          {
            t: 1,
            v: "#ppt_y-(0.354*#ppt_w-0.172*#ppt_h)",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.455,
        du: 0.16,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y-(0.354*#ppt_w-0.172*#ppt_h)",
          },
          {
            t: 1,
            v: "#ppt_y-(0.354*#ppt_w-0.172*#ppt_h)-#ppt_h/2",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.864,
        du: 0.14,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y-(0.354*#ppt_w-0.172*#ppt_h)",
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
            v: "#ppt_h/20",
          },
          {
            t: 0.5,
            v: "#ppt_h/20",
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
            v: "#ppt_w+.3",
          },
          {
            t: 0.5,
            v: "#ppt_w+.3",
          },
          {
            t: 1,
            v: "#ppt_w",
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
            v: "#ppt_x-.3",
          },
          {
            t: 0.5,
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
    id: 40, //"unfold",
    l: "Unfold",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 0,
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
            v: "#ppt_x-.1",
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
            v: "#ppt_h/10",
          },
          {
            t: 0.5,
            v: "#ppt_h+.01",
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
            v: "#ppt_w/10",
          },
          {
            t: 0.5,
            v: "#ppt_w+.01",
          },
          {
            t: 1,
            v: "#ppt_w",
          },
        ],
      },
      {
        ty: "filter",
        dl: 0,
        du: 0.5,
        rv: 0,
        fty: "fade",
        sty: 0,
      },
    ],
  },
  {
    id: 42, //"ascend",
    l: "Ascend",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 0,
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
            v: "#ppt_y+.1",
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
    id: 43, //"centerrevolve",
    l: "Center Revolve",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 0.1,
        rv: 0,
        fty: "fade",
        sty: 0,
      },
      {
        ty: "props",
        dl: 0,
        du: 0.4,
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
        du: 0.4,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y+0.31",
          },
          {
            t: 1,
            v: "#ppt_y+0.31",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.4,
        du: 0.6,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x",
          },
          {
            t: 0.05,
            v: "#ppt_x+0.0242",
          },
          {
            t: 0.1,
            v: "#ppt_x+0.0479",
          },
          {
            t: 0.15,
            v: "#ppt_x+0.0704",
          },
          {
            t: 0.2,
            v: "#ppt_x+0.0911",
          },
          {
            t: 0.25,
            v: "#ppt_x+0.1096",
          },
          {
            t: 0.3,
            v: "#ppt_x+0.1254",
          },
          {
            t: 0.35,
            v: "#ppt_x+0.1381",
          },
          {
            t: 0.4,
            v: "#ppt_x+0.1474",
          },
          {
            t: 0.45,
            v: "#ppt_x+0.1531",
          },
          {
            t: 0.5,
            v: "#ppt_x+0.1550",
          },
          {
            t: 0.55,
            v: "#ppt_x+0.1531",
          },
          {
            t: 0.6,
            v: "#ppt_x+0.1474",
          },
          {
            t: 0.65,
            v: "#ppt_x+0.1381",
          },
          {
            t: 0.7,
            v: "#ppt_x+0.1254",
          },
          {
            t: 0.75,
            v: "#ppt_x+0.1096",
          },
          {
            t: 0.8,
            v: "#ppt_x+0.0911",
          },
          {
            t: 0.85,
            v: "#ppt_x+0.0704",
          },
          {
            t: 0.9,
            v: "#ppt_x+0.0479",
          },
          {
            t: 0.95,
            v: "#ppt_x+0.0242",
          },
          {
            t: 1,
            v: "#ppt_x",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.4,
        du: 0.6,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y+0.31",
          },
          {
            t: 0.05,
            v: "#ppt_y+0.308",
          },
          {
            t: 0.1,
            v: "#ppt_y+0.3024",
          },
          {
            t: 0.15,
            v: "#ppt_y+0.2931",
          },
          {
            t: 0.2,
            v: "#ppt_y+0.2804",
          },
          {
            t: 0.25,
            v: "#ppt_y+0.2646",
          },
          {
            t: 0.3,
            v: "#ppt_y+0.2461",
          },
          {
            t: 0.35,
            v: "#ppt_y+0.2253",
          },
          {
            t: 0.4,
            v: "#ppt_y+0.2029",
          },
          {
            t: 0.45,
            v: "#ppt_y+0.1792",
          },
          {
            t: 0.5,
            v: "#ppt_y+0.155",
          },
          {
            t: 0.55,
            v: "#ppt_y+0.1307",
          },
          {
            t: 0.6,
            v: "#ppt_y+0.1071",
          },
          {
            t: 0.65,
            v: "#ppt_y+0.0846",
          },
          {
            t: 0.7,
            v: "#ppt_y+0.0639",
          },
          {
            t: 0.75,
            v: "#ppt_y+0.0454",
          },
          {
            t: 0.8,
            v: "#ppt_y+0.0296",
          },
          {
            t: 0.85,
            v: "#ppt_y+0.0169",
          },
          {
            t: 0.9,
            v: "#ppt_y+0.0076",
          },
          {
            t: 0.95,
            v: "#ppt_y+0.0019",
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
    id: 45, //"fadedswivel",
    l: "Faded Swivel",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 0,
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
            f: "#ppt_w*sin(2.5*pi*$)",
          },
          {
            t: 1,
            v: "1",
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
    ],
  },
  {
    id: 47, //"descend",
    l: "Descend",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 0,
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
            v: "#ppt_y-.1",
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
            v: "90",
          },
          {
            t: 0.8,
            v: "90",
          },
          {
            t: 0.8,
            v: "90",
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
            v: "-1",
          },
          {
            t: 0.5,
            v: "0.95",
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
            v: "#ppt_y",
          },
        ],
      },
      {
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 0,
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
            v: "0",
          },
          {
            t: 1,
            v: "#ppt_w",
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
            v: "0",
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
        pr: "rotation",
        cm: [
          {
            t: 0,
            v: "360",
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
        rv: 0,
        fty: "fade",
        sty: 0,
      },
    ],
  },
  {
    id: 50, //"compress",
    l: "Compress",
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
            v: "#ppt_w+.3",
          },
          {
            t: 1,
            v: "#ppt_w",
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
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 0,
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
        dl: 0,
        du: 0.77,
        rv: 0,
        fty: "fade",
        sty: 0,
      },
      {
        ty: "scaleto",
        dl: 0,
        du: 0.77,
        fromX: 10,
        toX: 200,
        fromY: 10,
        toY: 450,
      },
      {
        ty: "scaleto",
        dl: 0.77,
        du: 1.23,
        fromX: 200,
        toX: 100,
        fromY: 450,
        toY: 100,
      },
      {
        ty: "props",
        dl: 0,
        du: 0.77,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "#ppt_x",
          },
          {
            t: 1,
            v: "(0.5)",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.77,
        du: 1.23,
        pr: "ppt_x",
        cm: [
          {
            t: 0,
            v: "(0.5)",
          },
          {
            t: 1,
            v: "(#ppt_x)",
          },
        ],
      },
      {
        ty: "props",
        dl: 0,
        du: 0.77,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_y",
          },
          {
            t: 1,
            v: "(#ppt_y+0.4)",
          },
        ],
      },
      {
        ty: "props",
        dl: 0.77,
        du: 1.23,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "(#ppt_y+0.4)",
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
    id: 52, //"curveup",
    l: "Curve Up",
    rv: 0,
    pn: null,
    bh: [
      {
        ty: "scaleto",
        dl: 0,
        du: 1,
        fromX: 250,
        toX: 100,
        fromY: 250,
        toY: 100,
      },
      {
        ty: "motion",
        dl: 0,
        du: 1,
        cm: [
          {
            c: "M",
            p: [-336.5, 501.59],
          },
          {
            c: "C",
            p: [-270.12, 477.94, -18.37, 406.51, 65.38, 359.71],
          },
          {
            c: "C",
            p: [149.38, 312.92, 155.87, 272.13, 166.87, 220.46],
          },
          {
            c: "C",
            p: [177.88, 168.78, 159.25, 86.21, 131.5, 49.42],
          },
          {
            c: "C",
            p: [103.75, 12.64, 27.37, 0, 0, 0],
          },
        ],
      },
      {
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 0,
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
            v: "0",
          },
          {
            t: 1,
            v: "#ppt_w",
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
            v: "0",
          },
          {
            t: 1,
            v: "#ppt_h",
          },
        ],
      },
      {
        ty: "filter",
        dl: 0,
        du: 0.5,
        rv: 0,
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
            v: "#ppt_w*0.05",
          },
          {
            t: 1,
            v: "#ppt_w",
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
            t: 1,
            v: "#ppt_h",
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
            v: "#ppt_x-.2",
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
        ty: "filter",
        dl: 0,
        du: 0.5,
        rv: 0,
        fty: "fade",
        sty: 0,
      },
    ],
  },
  {
    id: 55, //"expand",
    l: "Expand",
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
            v: "#ppt_w*0.70",
          },
          {
            t: 1,
            v: "#ppt_w",
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
        ty: "filter",
        dl: 0,
        du: 1,
        rv: 0,
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
            v: "#ppt_w",
          },
          {
            t: 1,
            v: "#ppt_w",
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
            v: "(-#ppt_h/2)",
          },
          {
            t: 1,
            v: "(#ppt_y)",
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
    id: 58, //"fold",
    l: "Fold",
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
            v: "#ppt_w*2.5",
          },
          {
            t: 1,
            v: "#ppt_w",
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
            v: "#ppt_h*0.01",
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
        du: 0.5,
        pr: "ppt_y",
        cm: [
          {
            t: 0,
            v: "#ppt_h+1",
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
        rv: 0,
        fty: "fade",
        sty: 0,
      },
    ],
  },
];
