import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Line3, LineSegments, Matrix4, MeshBasicMaterial, Plane, Vector3 } from 'three';
import { IFCDOOR, IFCMEMBER, IFCPLATE, IFCSLAB, IFCWALL, IFCWALLSTANDARDCASE, IFCWINDOW } from 'web-ifc';
import { MeshBVH } from 'three-mesh-bvh';
export class ClippingEdges {
  constructor(context, clippingPlane, ifc) {
    this.context = context;
    this.clippingPlane = clippingPlane;
    this.ifc = ifc;
    this.edges = {};
    this.inverseMatrix = new Matrix4();
    this.localPlane = new Plane();
    this.tempLine = new Line3();
    this.tempVector = new Vector3();
    this.basicEdges = new LineSegments();
    this.newGeneratorGeometry();
  }
  remove() {
    // this.generatorGeometry.dispose();
    // this.thickEdges.removeFromParent();
    // this.thickLineGeometry.dispose();
  }
  async updateEdges() {
    const model = this.context.items.ifcModels[0];
    if (Object.keys(ClippingEdges.styles).length === 0) {
      await this.newStyle(model.modelID, 'thick', [IFCWALLSTANDARDCASE, IFCWALL, IFCSLAB], new LineMaterial({ color: 0x000000, linewidth: 0.0015 }));
      await this.newStyle(model.modelID, 'thin', [IFCWINDOW, IFCPLATE, IFCMEMBER, IFCDOOR], new LineMaterial({ color: 0x333333, linewidth: 0.001 }));
    }
    Object.keys(ClippingEdges.styles).forEach((style) => {
      this.drawEdges(ClippingEdges.styles[style], model);
    });
  }
  async newStyle(modelID, styleName, categories, material = ClippingEdges.defaultMaterial) {
    const generatorGeometry = this.newGeneratorGeometry();
    const thickLineGeometry = new LineSegmentsGeometry();
    material.clippingPlanes = this.context.getClippingPlanes();
    ClippingEdges.styles[styleName] = {
      modelID,
      categories,
      generatorGeometry,
      thickLineGeometry,
      model: this.context.items.ifcModels[modelID],
      thickEdges: this.newThickEdges(thickLineGeometry, material),
      subset: await this.newSubset(styleName, modelID, categories)
    };
  }
  async newSubset(styleName, modelID, categories) {
    const subset = this.ifc.loader.ifcManager.createSubset({
      modelID,
      customId: `${styleName}`,
      material: ClippingEdges.invisibleMaterial,
      removePrevious: true,
      scene: this.context.getScene(),
      ids: await this.getItemIDs(modelID, categories)
    });
    if (subset) {
      subset.geometry.boundsTree = new MeshBVH(subset.geometry, { maxLeafTris: 3 });
      return subset;
    }
    throw new Error(`Subset could not be created for the following style: ${styleName}`);
  }
  async getItemIDs(modelID, categories) {
    const ids = [];
    for (let j = 0; j < categories.length; j++) {
      // eslint-disable-next-line no-await-in-loop
      const found = await this.ifc.getAllItemsOfType(modelID, categories[j], false);
      ids.push(...found);
    }
    return ids;
  }
  newThickEdges(thickLineGeometry, material) {
    const thickEdges = new LineSegments2(thickLineGeometry, material);
    thickEdges.material.polygonOffset = true;
    thickEdges.material.polygonOffsetFactor = -2;
    thickEdges.material.polygonOffsetUnits = 1;
    thickEdges.renderOrder = 3;
    return thickEdges;
  }
  newGeneratorGeometry() {
    // create line geometry with enough data to hold 100000 segments
    const generatorGeometry = new BufferGeometry();
    const linePosAttr = new BufferAttribute(new Float32Array(300000), 3, false);
    linePosAttr.setUsage(DynamicDrawUsage);
    generatorGeometry.setAttribute('position', linePosAttr);
    return generatorGeometry;
  }
  // Source: https://gkjohnson.github.io/three-mesh-bvh/example/bundle/clippedEdges.html
  drawEdges(style, model) {
    if (!style.subset.geometry.boundsTree)
      return;
    this.inverseMatrix.copy(style.subset.matrixWorld).invert();
    this.localPlane.copy(this.clippingPlane).applyMatrix4(this.inverseMatrix);
    let index = 0;
    const posAttr = style.generatorGeometry.attributes.position;
    // @ts-ignore
    posAttr.array.fill(0);
    style.subset.geometry.boundsTree.shapecast({
      intersectsBounds: (box) => {
        return this.localPlane.intersectsBox(box);
      },
      // @ts-ignore
      intersectsTriangle: (tri) => {
        // check each triangle edge to see if it intersects with the plane. If so then
        // add it to the list of segments.
        let count = 0;
        this.tempLine.start.copy(tri.a);
        this.tempLine.end.copy(tri.b);
        if (this.localPlane.intersectLine(this.tempLine, this.tempVector)) {
          posAttr.setXYZ(index, this.tempVector.x, this.tempVector.y, this.tempVector.z);
          count++;
          index++;
        }
        this.tempLine.start.copy(tri.b);
        this.tempLine.end.copy(tri.c);
        if (this.localPlane.intersectLine(this.tempLine, this.tempVector)) {
          posAttr.setXYZ(index, this.tempVector.x, this.tempVector.y, this.tempVector.z);
          count++;
          index++;
        }
        this.tempLine.start.copy(tri.c);
        this.tempLine.end.copy(tri.a);
        if (this.localPlane.intersectLine(this.tempLine, this.tempVector)) {
          posAttr.setXYZ(index, this.tempVector.x, this.tempVector.y, this.tempVector.z);
          count++;
          index++;
        }
        // If we only intersected with one or three sides then just remove it. This could be handled
        // more gracefully.
        if (count !== 2) {
          index -= count;
        }
      }
    });
    // set the draw range to only the new segments and offset the lines so they don't intersect with the geometry
    style.thickEdges.geometry.setDrawRange(0, index);
    style.thickEdges.position.copy(this.clippingPlane.normal).multiplyScalar(0.0001);
    posAttr.needsUpdate = true;
    this.basicEdges.geometry = style.generatorGeometry;
    style.thickEdges.geometry = style.thickLineGeometry.fromLineSegments(this.basicEdges);
    if (style.thickEdges.parent !== model) {
      model.add(style.thickEdges);
    }
  }
}
ClippingEdges.styles = {};
ClippingEdges.invisibleMaterial = new MeshBasicMaterial({ visible: false });
ClippingEdges.defaultMaterial = new LineMaterial({ color: 0x000000, linewidth: 0.001 });