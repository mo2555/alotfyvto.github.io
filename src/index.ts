import { PoseEngine } from "@geenee/bodyprocessors/dist/bodyprocessors";
import { Recorder } from "@geenee/armature";
import { OutfitParams } from "@geenee/bodyrenderers-common";
import { AvatarRenderer } from "./avatarrenderer";
import "./index.css";

// Engine
const engine = new PoseEngine();
var token = location.hostname === "localhost" ?
    "l8vd8BEZ0y2AwDOZJ8JoiGt0JI8YN_jx" : "0Z5FsOvFh_eUMORg00J167xogPRSut5c";

// Parameters
const urlParams = new URLSearchParams(window.location.search);
let rear = urlParams.has("rear");
let id = urlParams.get("id");
// Model map
var modelMap: {
    [key: string]: {
        file: string, avatar: boolean,
        outfit?: OutfitParams
    }
} = {
data:  {
        file: "https://ahmedlotfysuits.com/storage/app/public/product/suit-files/2023-10-30-653fff90f00df.glp", avatar: false,
        outfit: {
            occluders: [/Head$/, /Body/]
        }


          
    }

}
let model = "data";
let avatar = modelMap["data"].avatar;

// Create spinner element
function createSpinner() {
    const container = document.createElement("div");
    container.className = "spinner-container";
    container.id = "spinner";
    const spinner = document.createElement("div");
    spinner.className = "spinner";
    for (let i = 0; i < 6; i++) {
        const dot = document.createElement("div");
        dot.className = "spinner-dot";
        spinner.appendChild(dot);
    }
    container.appendChild(spinner);
    return container;
}

async function main() {
    // Renderer
    const container = document.getElementById("root");
    if (!container)
        return;
    const renderer = new AvatarRenderer(
        container, "crop", !rear, modelMap[model].file,
        avatar ? undefined : modelMap[model].outfit);
    // Camera switch
    const cameraSwitch = document.getElementById(
        "camera-switch") as HTMLButtonElement | null;
    if (cameraSwitch) {
        cameraSwitch.onclick = async () => {
            cameraSwitch.disabled = true;
            rear = !rear;
            await engine.setup({ size: { width: 1920, height: 1080 }, rear });
            await engine.start();
            renderer.setMirror(!rear);
            cameraSwitch.disabled = false;
        }
    }
    // Outfit switch
    const outfitSwitch = document.getElementById(
        "outfit-switch") as HTMLInputElement;
    outfitSwitch.checked = avatar;
    outfitSwitch.onchange = async () => {
        modelBtns.forEach((btn) => { btn.disabled = true; })
        outfitSwitch.disabled = true;
        const spinner = createSpinner();
        document.body.appendChild(spinner);
        avatar = outfitSwitch.checked;
        await renderer.setOutfit(
            modelMap[model].file,
            avatar ? undefined : modelMap[model].outfit);
        document.body.removeChild(spinner);
        modelBtns.forEach((btn) => { btn.disabled = false; });
        outfitSwitch.disabled = false;
    }
    // Recorder
    const safari = navigator.userAgent.indexOf('Safari') > -1 &&
                   navigator.userAgent.indexOf('Chrome') <= -1
    const ext = safari ? "mp4" : "webm";
    const recorder = new Recorder(renderer, "video/" + ext);
    const recordButton = document.getElementById(
        "record") as HTMLButtonElement | null;
    if (recordButton)
        recordButton.onclick = () => {
            recorder?.start();
            setTimeout(async () => {
                const blob = await recorder?.stop();
                if (!blob)
                    return;
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.hidden = true;
                link.href = url;
                link.download = "capture." + ext;
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
            }, 10000);
        };
    // Model carousel
    const modelBtns = document.getElementsByName(
        "model") as NodeListOf<HTMLInputElement>;
    modelBtns.forEach((btn) => {
        btn.onchange = async () => {
            if (btn.checked && modelMap[btn.value]) {
                modelBtns.forEach((btn) => { btn.disabled = true; })
                outfitSwitch.disabled = true;
                const spinner = createSpinner();
                document.body.appendChild(spinner);
                model = btn.value;
                avatar = modelMap[model].avatar;
                await renderer.setOutfit(
                    modelMap[model].file,
                    avatar ? undefined : modelMap[model].outfit);
                outfitSwitch.checked = avatar;
                document.body.removeChild(spinner);
                modelBtns.forEach((btn) => { btn.disabled = false; });
                outfitSwitch.disabled = false;
            }
        };
    });
    // Initialization
    await Promise.all([
        engine.addRenderer(renderer),
        engine.init({ token: token })
    ]);
    await engine.setup({ size: { width: 1920, height: 1080 }, rear });
    await engine.start();
    document.getElementById("dots")?.remove();
}

var tempData = {
    file: "",
    token:""

};

fetch("https://ahmedlotfysuits.com/api/v4/token_with_file/"+id).then(res => res.json()).then(data =>
    tempData = data 
)
    .then(() => {
        modelMap.data = {
            file: tempData.file, avatar: false,
            outfit: {
                occluders: [/Head$/, /Body/]
            }
        }
        token = tempData.token
        main()
    });

