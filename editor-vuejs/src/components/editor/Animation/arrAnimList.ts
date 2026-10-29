import { arrAnimEmphasis } from "./arrAnimEmphasis";
import { arrAnimEntrance } from "./arrAnimEntrance";
import { arrAnimExit } from "./arrAnimExit";

const arrAnimList: any[] = [
  arrAnimEntrance,
  arrAnimEmphasis,
  arrAnimExit,
  [
    {
      id: 132, //"line",
      l: "Line",
      pn: null,
      d: [
        {
          c: "M",
          p: [0, 0],
        },
        {
          c: "L",
          p: [200, 0],
        },
      ],
    },
    {
      id: 0, //"freehand",
      l: "Freehand",
      pn: null,
      d: [
        {
          c: "M",
          p: [0, 0],
        },
        {
          c: "L",
          p: [200, 0],
        },
        {
          c: "L",
          p: [200, 100],
        },
      ],
    },
    {
      id: 134, //"rectangle",
      l: "Rectangle",
      pn: null,
      d: [
        {
          c: "M",
          p: [0, 0],
        },
        {
          c: "L",
          p: [200, 0],
        },
        {
          c: "L",
          p: [200, 200],
        },
        {
          c: "L",
          p: [0, 200],
        },
        {
          c: "L",
          p: [0, 1],
        },
      ],
    },
    // {
    //   id: 135,
    //   l: "Circle",
    //   pn: null,
    //   d: "ellipse",
    // }
  ],
  [
    {
      id: 83, //"play",
      l: "Play",
      pn: null,
      du: 0,
      bh: [
        {
          ty: "play",
          dl: 0,
          du: 0.1,
          rp: 0,
          cm: "playFrom(0.0)",
        },
      ],
    },
    {
      id: 84, //"pause",
      l: "Pause",
      pn: null,
      du: 0,
      bh: [
        {
          ty: "play",
          dl: 0,
          du: 0,
          rp: 0,
          cm: "togglePause",
        },
      ],
    },
    {
      id: 85, //"stop",
      l: "Stop",
      pn: null,
      du: 0,
      bh: [
        {
          ty: "play",
          dl: 0,
          du: 0,
          rp: 0,
          cm: "stop",
        },
      ],
    },
    {
      id: 10000, //"click",
      l: "Button Click",
      pn: null,
      du: 0,
      bh: [
        {
          ty: "click",
          dl: 0,
          du: 0,
          rp: 0,
          cm: "click",
        },
      ],
    },
  ],
];

const defAnimList = arrAnimList.map((grp) => {
  const grpObj = {};
  grp.forEach((eff) => {
    grpObj[eff.id] = {
      ...eff,
    };
  });
  return grpObj;
});

export default defAnimList;
