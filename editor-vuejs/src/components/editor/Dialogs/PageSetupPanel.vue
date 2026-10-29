<template>
  <DialogBase title="Page Setup" backLink="settings" backLinkLabel="Back">
    <div class="sgDialogContent">
      <div class="dialogSection">
        <div class="dialogSectionContent">
          <table class="formTable">
            <tbody>
              <!--<tr><td>Thumbnail: </td><td><div id="fileThumbnail"></div></td></tr>-->
              <tr>
                <td colspan="2">
                  <select id="cboFileSize" onchange="updateSlideDimension()">
                    <option>Custom</option>
                    <option value="720x540">iPad Screen (4:3)</option>
                    <option value="720x405">Wide Screen (16:9)</option>
                    <option value="320x480">iPhone Screen</option>
                    <option value="540x780">A4 Paper</option>
                  </select>
                </td>
              </tr>
              <tr>
                <td>Width</td>
                <td><input id="txtFileWidth" size="3" />px</td>
              </tr>
              <tr>
                <td>Height</td>
                <td><input id="txtFileHeight" size="3" />px</td>
              </tr>
            </tbody>
          </table>
          <table class="formTable">
            <tbody>
              <tr>
                <td>
                  <span onclick="updateFileProperties()" class="fileinputlabel"
                    >Resize with objects</span
                  ><br /><span class="fileinputlabel"
                    >Resize canvas only</span
                  >
                  <form id="stretchFrm">
                    <p>Fit screen when playing:<br /></p>
                    <p>
                      <input
                        class="custom"
                        id="radStretch1"
                        name="radStretch"
                        type="radio"
                        onclick="updateStretchType()"
                        value="0"
                      /><label for="radStretch1">Keep ratio</label
                      >&nbsp;<br /><input
                        class="custom"
                        id="radStretch2"
                        name="radStretch"
                        type="radio"
                        onclick="updateStretchType()"
                        value="1"
                      /><label for="radStretch2">Stretch content</label
                      >&nbsp;<br /><input
                        class="custom"
                        id="radStretch4"
                        name="radStretch"
                        type="radio"
                        onclick="updateStretchType()"
                        value="3"
                      /><label for="radStretch4">Stretch master</label
                      >&nbsp;<br /><input
                        class="custom"
                        id="radStretch3"
                        name="radStretch"
                        type="radio"
                        onclick="updateStretchType()"
                        value="2"
                      /><label for="radStretch3">Fill background</label>
                    </p>
                  </form>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </DialogBase>
</template>

<script setup>
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
// import { resizeCanvas } from "shared-vuejs/src/edlib/main/canvas";
</script>
