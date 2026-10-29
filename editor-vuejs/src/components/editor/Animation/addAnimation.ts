import { updateSlideAnimations, getSlideInfo } from "shared-vuejs/editor";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { piniaSelect } from "@/lib/common/store";
import { toggleTaskPane } from "@/lib/main/utils";
import defAnimList from "./arrAnimList";

export async function addEffect(grp, id, path?, targetIds?) {
  const selection = piniaSelect();
  const selectedIds = [...new Set(
    targetIds || (selection.selGrpShps?.length ? selection.selGrpShps : selection.selShps),
  )].filter(Boolean);
  if (!selectedIds.length) return;

  var effInfo = defAnimList[grp][id];

  var prv = 0;
  if (effInfo.pv && effInfo.pv.length > 0 && effInfo.pv[0].v) {
    prv = effInfo.pv[0].v;
  }

  let du, bh;
  if (effInfo.d) {
    bh = [{ ty: "motion", sp: 1, du: 1, dl: 0, cm: path }];
    du = 1;
  } else {
    bh = getEffBehavior(effInfo, grp, prv);
    du = effInfo.du;
  }

  const eff = {
    re: grp == 0 ? 1 : 0,
    presetID: id,
    tr: 1,
    prv: prv,
    du: du,
    dl: 0,
    rw: 0,
    rv: 0,
    rp: 1,
    bh: bh,
    grp,
    ...(grp == 3 ? { cls: "motion" } : {}),
  };

  const shapesAnim = (getSlideInfo().timing);

  const m = shapesAnim?.m || [];

  for (const shapeId of selectedIds) {
    // Each shape owns its behaviors so later edits cannot affect its peers
    // or mutate the preset catalog (including nested motion/keyframe data).
    m.push({ ...eff, sh: shapeId, bh: JSON.parse(JSON.stringify(bh)) });
  }

  updateSlideAnimations({
    ...shapesAnim,
    m,
  });

  await saveDexie();

  toggleTaskPane("animations");
}

function getEffBehavior(effInfo, grp, prv) {
  var bh;
  if (Array.isArray(effInfo.bh)) {
    bh = [...effInfo.bh]; //copy
  } else if (typeof effInfo.bh == "object") {
    if (prv) {
      bh = [...effInfo.bh[prv]];
    } else {
      bh = [...effInfo.bh[effInfo.pv[0].v]];
    }
  }
  if (!bh) bh = [];

  if (!effInfo.du) {
    effInfo.du = 1;
  }

  //insert a default for entrance and exit
  if (grp == 0) {
    // if (id != 11) {
    bh.splice(0, 0, {
      ty: "set",
      sp: 1,
      dl: 0,
      du: 0.0,
      cm: "visibility",
      v: "1",
    });
    // }
  } else if (grp == 2) {
    bh.push({ ty: "set", sp: 1, dl: 0.499, du: 0.0, cm: "visibility", v: "0" });
  }

  return bh;
}
