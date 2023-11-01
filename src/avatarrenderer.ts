
import { PoseRenderer, PoseOutfitPlugin } from "@geenee/bodyrenderers-babylon";
import { OutfitParams } from "@geenee/bodyrenderers-common";
import { PoseResult } from "@geenee/bodyprocessors";
import { Scene } from "@babylonjs/core/scene";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/loaders/glTF";

// Renderer
export class AvatarRenderer extends PoseRenderer {
    // Scene
    protected plugin: PoseOutfitPlugin;
    protected model?: AbstractMesh
    protected light?: PointLight;
    protected ambient?: HemisphericLight;
    readonly lightInt: number = 0.5;
    readonly ambientInt: number = 0.5;
    // Hands up
    protected handsUp = false;
    protected textModel?: AbstractMesh;

    // Constructor
    constructor(
        container: HTMLElement,
        mode?: "fit" | "crop",
        mirror?: boolean,
        protected url = "onesie.glb",
        protected outfit?: OutfitParams) {
        super(container, mode, mirror);
        this.plugin = new PoseOutfitPlugin(undefined, outfit);
        this.addPlugin(this.plugin);
    }

    // Load assets and setup scene
    async load() {
        if (this.loaded || !this.scene)
            return;
        await this.setupScene(this.scene);
        return super.load();
    }

    // Setup scene
    protected async setupScene(scene: Scene) {
        // Model
        await this.setModel(this.url);
        // Lightning
        this.light = new PointLight("pointLight",
            new Vector3(0, 0, 0), scene);
        this.light.intensity = this.lightInt;
        this.light.diffuse = new Color3(1, 1, 1);
        this.light.specular = new Color3(1, 1, 1);
        this.ambient = new HemisphericLight("ambientLight",
            new Vector3(0, 1, 0), scene);
        this.ambient.intensity = this.ambientInt;
        this.ambient.diffuse = new Color3(1, 1, 1);
        this.ambient.specular = new Color3(1, 1, 1);
        this.ambient.groundColor = new Color3(1, 1, 1);
        // Environment
        scene.createDefaultEnvironment({
            createSkybox: false,
            environmentTexture: "environment.env" });
        scene.clearColor = new Color4(0, 0, 0, 0);
        scene.ambientColor = new Color3(1, 1, 1);
        // Text model
        const gltf = await SceneLoader.
            LoadAssetContainerAsync("./", "text.glb", scene);
        const textMesh = gltf.meshes.find((m) => m.id === "Text");
        if (textMesh) {
            textMesh.scaling.setAll(0.075);
            textMesh.rotate(Vector3.Up(), Math.PI);
            textMesh.rotate(Vector3.Right(), Math.PI / 2);
        }
        this.textModel = gltf.meshes.find((m) => m.id === "__root__");
        gltf.addAllToScene();
    }

    // Set model to render
    async setModel(url: string) {
        return this.setOutfit(url, this.outfit);
    }

    // Set outfit to render
    async setOutfit(url: string, outfit?: OutfitParams) {
        if (this.model) {
            this.scene?.removeMesh(this.model, true);
            this.model.dispose(true, true);
        }
        delete this.model;
        this.url = url;
        this.outfit = outfit;
        const gltf = await SceneLoader.
            LoadAssetContainerAsync("", url, this.scene, undefined, ".glb");
        this.model = gltf.meshes.find((m) => m.id === "__root__");
        gltf.addAllToScene();
        this.plugin.setOutfit(this.model, outfit);
    }

    // Update
    async update(result: PoseResult, stream: HTMLCanvasElement): Promise<void> {
        // Analyze pose keypoints to detect hands up
        const pose = result.poses && result.poses.length > 0 ?
            result.poses[0] : undefined;
        if (!pose) {
            this.handsUp = false;
            return super.update(result, stream);
        }
        // Keypoints
        const { points } = pose;
        const hipL = new Vector3(...points.hipL.metric);
        const hipR = new Vector3(...points.hipR.metric);
        const shoulderL = new Vector3(...points.shoulderL.metric);
        const shoulderR = new Vector3(...points.shoulderR.metric);
        const elbowL = new Vector3(...points.elbowL.metric);
        const elbowR = new Vector3(...points.elbowR.metric);
        const wristL = new Vector3(...points.wristL.metric);
        const wristR = new Vector3(...points.wristR.metric);
        // Arm vectors
        const torsoL = shoulderL.subtract(hipL).normalize();
        const torsoR = shoulderR.subtract(hipR).normalize();
        const armL = elbowL.subtract(shoulderL).normalize();
        const armR = elbowR.subtract(shoulderR).normalize();
        const foreArmL = wristL.subtract(elbowL).normalize();
        const foreArmR = wristR.subtract(elbowR).normalize();
        // Dot product of unit vectors gives cos of angle between
        // If vectors are parallel, angle is close to 0, cos to 1
        const armLCos = Vector3.Dot(torsoL, armL);
        const armRCos = Vector3.Dot(torsoR, armR);
        const foreArmLCos = Vector3.Dot(foreArmL, armL);
        const foreArmRCos = Vector3.Dot(foreArmR, armR);
        // Hands are up if all vectors have almost the same direction
        // Add hysteresis when changing mouth state to reduce noise
        const cosMin = Math.min(armLCos, armRCos, foreArmLCos, foreArmRCos);
        if (cosMin > 0.8)
            this.handsUp = true;
        if (cosMin < 0.7)
            this.handsUp = false;
        // Position text model
        const { textModel } = this;
        if (textModel) {
            const position = Vector3.Lerp(wristL, wristR, 0.5);
            textModel.position = position;
            textModel.setEnabled(this.handsUp);
        }
        await super.update(result, stream);
    }
}
