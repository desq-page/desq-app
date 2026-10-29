import {  } from "shared-vuejs/editor";
import { nextTick } from "vue";
import g from "shared-vuejs/api/global";

import { piniaInfo } from "../common/store";

let statusMsgTimeout;

export function loadAudio(id, index) {
  // let el = gid(id);
  // let name = el.id; //.getAttribute('data-name')
  // if (!gid(name + "_i")) {
  //   let img = new SGElement("img", {
  //     id: name + "_i",
  //     src: window.soundiconPNG,
  //     style: "width:" + offW(el) + "px;height:" + offH(el) + "px",
  //   });
  //   el.appendChild(img);
  // }
  // if (!window.isIE8) {
  //   let audio = gid(id).children[0]; //gid(name + '_a');
  //   audio.id = name + "_a";
  //   audio.controls = "controls";
  //   //gid(id).style.overflow = 'hidden'
  //   audio.style.visibility = "hidden";
  //   audio.className = "abs";
  //   //audio.style.top = offH(el) + 'px'
  //   return audio;
  // } else {
  //   // let url = gid(id).children[0].getAttribute('src');
  //   // let fid = name + '_a';
  //   // let faudio = gid(fid);
  //   // if (!faudio) {
  //   // 	createFl(fid, id, url)
  //   // }
  //   return null; //no reference needed, use Flash event instead
  // }
}

export function displayFileTitle(title) {
  document.title = title;
}

export function showMessage(text, time?, type?) {
  if (statusMsgTimeout) {
    clearTimeout(statusMsgTimeout);
    statusMsgTimeout = null;
  }
  if (!text) {
    piniaInfo().statusMessage = null;
  } else {
    piniaInfo().statusMessage = {
      text,
      type: type || "info",
    };
    if (time) {
      statusMsgTimeout = setTimeout(
        () => (piniaInfo().statusMessage = null),
        time,
      );
    }
  }
}

export function showError(text, title?) {
  // showMessage(text, time, "error");
  piniaInfo().loadingBar = "";
  nextTick(() => {
    g.globalDialog.destroyAll();
    g.globalDialog.error({
      title: title || "Error",
      content: text,
      positiveText: "OK",
      closable: false,
    });
  });
}

export function toggleTaskPane(tab, props?) {
  // since this will resize, may need to check how to avoid click on bottom object
  if (piniaInfo().currentTaskPane == tab) {
    // highlight
    const taskPane: any = document.querySelector("#taskPane");
    taskPane.style.filter = "brightness(0.95)";
    setTimeout(() => (taskPane.style.filter = ""), 100);
  } else {
    if (
      piniaInfo().currentTaskPane !== "formatslide" &&
      piniaInfo().currentTaskPane !== "localmediatab"
    ) {
      // do not save if in localmediatab or slide
      piniaInfo().setLastTaskPane(piniaInfo().currentTaskPane)
    }
    piniaInfo().setCurTaskPane(tab)
  }
  if (piniaInfo().currentTaskPane == piniaInfo().lastTaskPane) {
    piniaInfo().setLastTaskPane("");
  }
}
