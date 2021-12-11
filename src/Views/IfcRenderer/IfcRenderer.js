import React, { useEffect, useState, useRef } from 'react';
import { IfcViewerAPI } from 'web-ifc-viewer';
import Dropzone from 'react-dropzone';
import {
  Backdrop,
  makeStyles,
  CircularProgress,
  Fab,
  Grid
} from '@material-ui/core';
import FolderOpenOutlinedIcon from '@material-ui/icons/FolderOpenOutlined';
import CropIcon from '@material-ui/icons/Crop';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import DescriptionIcon from '@material-ui/icons/Description';
import SpatialStructure from './Components/SpatialStructure/SpatialStructure';
import Properties from './Components/Properties/Properties';
import DraggableCard from './Components/DraggableCard/DraggableCard';
import { IFCSPACE, IFCSTAIR, IFCCOLUMN, IFCWALLSTANDARDCASE, IFCWALL, IFCSLAB, IFCOPENINGELEMENT } from 'web-ifc';
import { exportDXF } from './utils/dxf';

import {
  Color,
  LineBasicMaterial,
  MeshBasicMaterial
} from 'three';


const useStyles = makeStyles((theme) => ({
  root: {
    width: '100vw',
    height: '100vh',
    spacing: 0,
    justify: 'space-around',
    margin: 0,
    padding: 0,
    flexGrow: 1,
    '& .MuiTextField-root': {
      margin: theme.spacing(1),
      backgroundColor: 'white'
    },
    '& .MuiContainer-maxWidthLg': {
      maxWidth: '100%'
    },
  },
  infoLeftPannel: {
    // marginTop: '1em',
    left: '1em',
    position: 'absolute',
    zIndex: 100
  },
  infoRightPannel: {
    // marginTop: '1em',
    right: '1em',
    position: 'absolute',
    zIndex: 100
  },
  fab: {
    margin: '0.5em',
    backgroundColor: 'white'
  }
}));

const IfcRenderer = () => {
  const classes = useStyles();
  const dropzoneRef = useRef(null);
  const [viewer, setViewer] = useState(null);
  const [modelID, setModelID] = useState(-1);
  const [transformControls, setTransformControls] = useState(null);
  const [spatialStructure, setSpatialStructure] = useState(null);
  const [element, setElement] = useState(null);
  const [showSpatialStructure, setShowSpatialStructure] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [isLoading, setLoading] = useState(false)
  const [percentageLoading, setPercentageLoading] = useState(false)

  const [state, setState] = useState({
    bcfDialogOpen: false,
    loaded: false,
    loadingIfc: false,
    openLeftView: false,
    leftView: 'spatialStructure',
  });

  useEffect(() => {
    async function createFill(viewer, fill) {
      const wallsStandard = await viewer.IFC.loader.ifcManager.getAllItemsOfType(0, IFCWALLSTANDARDCASE, false);
      const walls = await viewer.IFC.loader.ifcManager.getAllItemsOfType(0, IFCWALL, false);
      const stairs = await viewer.IFC.loader.ifcManager.getAllItemsOfType(0, IFCSTAIR, false);
      const columns = await viewer.IFC.loader.ifcManager.getAllItemsOfType(0, IFCCOLUMN, false);
      const slabs = await viewer.IFC.loader.ifcManager.getAllItemsOfType(0, IFCSLAB, false);
      const ids = [...walls, ...wallsStandard, ...columns, ...stairs, ...slabs];
      fill = viewer.fills.create('example', 0, ids, new MeshBasicMaterial({ color: 0x888888 }));
      fill.renderOrder = 2;
      if (fill) {
        fill.position.y += 0.01;
      }
      // fill.visible = false;
    }

    async function goToFirstFloor() {
      await viewer.plans.computeAllPlanViews(0);
      const firstFloor = viewer.plans.getAll()[0];
      await viewer.plans.goTo(firstFloor);
    }

    async function init() {
      const container = document.getElementById('viewer-container');
      const newViewer = new IfcViewerAPI({ container, backgroundColor: new Color(0xffffff) });
      // newViewer.addAxes();p
      // newViewer.addGrid();
      newViewer.IFC.setWasmPath('files/');
      newViewer.IFC.applyWebIfcConfig({ COORDINATE_TO_ORIGIN: true, USE_FAST_BOOLS: false });
      newViewer.IFC.loader.ifcManager.useWebWorkers(true, 'files/IFCWorker.js');


      let dimensionsActive = false;

      let fill;
      const handleKeyDown = async (event) => {
        // DIMENSIONS
        if (event.code === 'KeyP') {
          dimensionsActive = !dimensionsActive;
          newViewer.dimensions.active = dimensionsActive;
          newViewer.dimensions.previewActive = dimensionsActive;
          newViewer.IFC.unPrepickIfcItems();
          window.onmousemove = dimensionsActive ?
            null :
            newViewer.IFC.prePickIfcItem;
        }
        if (event.code === 'KeyL') {
          newViewer.dimensions.create();
        }
        if (event.code === 'KeyC') {
          newViewer.dimensions.cancelDrawing();
        }
        if (event.code === 'KeyG') {
          newViewer.clipper.createPlane();
        }
        if (event.code === 'KeyT') {
          newViewer.dimensions.deleteAll();
          newViewer.clipper.deletePlane();
          newViewer.IFC.unpickIfcItems();
        }

        // VIEW
        if (event.code === 'KeyO') {
          newViewer.context.getIfcCamera().toggleProjection();
        }
        if (event.code === 'KeyR') {
          newViewer.context.renderer.usePostproduction = !newViewer.context.renderer.usePostproduction;
        }


        // DRAWINGS
        if (event.code === 'KeyD') {
          exportDXF();
          // const scene = viewer.context.getScene();
          // fillSection(scene);
        }
        if (event.code === 'KeyF') {
          fill.visible = true;
        }
        if (event.code === 'KeyB') {
          await createFill(newViewer, fill);
          // await goToFirstFloor();
          // viewer.edges.toggle("01");
        }
        if (event.code === 'KeyE') {
          newViewer.plans.exitPlanView(true);
          newViewer.edges.toggle("01");
          fill.visible = false;
        }
      };

      window.onkeydown = handleKeyDown;

      window.ondblclick = newViewer.addClippingPlane;

      setViewer(newViewer);
    }
    init();
  }, [])

  const onDrop = async (files) => {
    if (files && viewer) {
      setLoading(true);

      viewer.IFC.loader.ifcManager.setOnProgress((event) => {
        const percentage = Math.floor((event.loaded * 100) / event.total);
        setPercentageLoading(percentage);
        console.log('POURCENTAGE', percentage)
        //progressText.innerText = `Loaded ${percentage}%`;
      });

      // setViewer(null);
      // await viewer.IFC.loadIfc(files[0], true, ifcOnLoadError);

      viewer.IFC.loader.ifcManager.parser.setupOptionalCategories({
        [IFCSPACE]: false,
        [IFCOPENINGELEMENT]: false
      });

      const model = await viewer.IFC.loadIfc(files[0], true, ifcOnLoadError);
      model.material.forEach(mat => mat.side = 2);

      viewer.edges.create("01", 0, new LineBasicMaterial({ color: 0x000000 }), new MeshBasicMaterial({ color: 0xffffff, side: 2 }));
      // const modelID = await viewer.IFC.getModelID();
      const spatialStructure = await viewer.IFC.getSpatialStructure(0);
      setSpatialStructure(spatialStructure);
      console.log('spatialStructure', spatialStructure);
      setLoading(false);
    }
  };

  const ifcOnLoadError = async (err) => {
    alert(err.toString());
  };

  const select = (modelID, expressID, pick = true) => {
    if (pick) viewer.IFC.pickIfcItemsByID(modelID, expressID);
    setModelID(modelID);
  }

  const handleClick = async () => {
    const found = await viewer.IFC.pickIfcItem(true, 1);

    if (found == null || found == undefined) return;

    select(found.modelID, found.id, false);
    const props = await viewer.IFC.getProperties(found.modelID, found.id, false);
    console.log(props);
    const type = await viewer.IFC.loader.ifcManager.getIfcType(found.modelID, found.id);
    console.log(type);
    const itemProperties = await viewer.IFC.loader.ifcManager.getItemProperties(found.modelID, found.id);
    console.log(itemProperties);
    const propertySets = await viewer.IFC.loader.ifcManager.getPropertySets(found.modelID, found.id);
    console.log(propertySets);
    if (propertySets.length > 0) {
      const psets = await Promise.all(propertySets.map(async (pset) => {
        if (pset.HasProperties && pset.HasProperties.length > 0) {
          const newPset = await Promise.all(pset.HasProperties.map(async (property) => {
            const prop = await viewer.IFC.loader.ifcManager.getItemProperties(found.modelID, property.value);
            const label = prop.Name.value;
            const value = prop.NominalValue ? prop.NominalValue.value : null;
            return {
              label,
              value
            }
          }));

          return {
            ...pset,
            HasProperties: [...newPset]
          }
        }
        if (pset.Quantities && pset.Quantities.length > 0) {
          const newPset = await Promise.all(pset.Quantities.map(async (property) => {
            const prop = await viewer.IFC.loader.ifcManager.getItemProperties(found.modelID, property.value);
            const label = prop.Name.value;
            const value = prop.NominalValue ? prop.NominalValue.value : null;
            return {
              label,
              value
            }
          }));

          return {
            ...pset,
            HasProperties: [...newPset]
          }
        }
      }));
      const elem = {
        ...itemProperties,
        type: type ? type : 'NO TYPE',
        modelID: found.modelID,
        psets
      };

      if (elem) {
        setElement(elem);
      }
    }
  }

  const handleToggleClipping = () => {
    viewer.clipper.active = !viewer.clipper.active;
  };

  const handleClickOpen = () => {
    dropzoneRef.current.open();
  };

  const handleShowSpatialStructure = () => {
    setShowSpatialStructure(!showSpatialStructure);
  };

  const handleShowProperties = async () => {
    setShowProperties(!showProperties);
  };

  return (
    <>
      <Grid container>
        {(spatialStructure && showSpatialStructure) &&
          <DraggableCard>
            <SpatialStructure
              viewer={viewer}
              spatialStructure={spatialStructure}
              handleShowSpatialStructure={handleShowSpatialStructure}
            />
          </DraggableCard>

        }
        {(element && showProperties) &&
          <DraggableCard>
            <Properties
              viewer={viewer}
              element={element}
              transformControls={transformControls}
              handleShowProperties={handleShowProperties}
            />
          </DraggableCard>
        }
        <Grid item xs={2} className={classes.infoLeftPannel}>
          <Grid item xs={12}>
            <Fab
              size="small"
              className={classes.fab}
              onClick={handleClickOpen}
            >
              <FolderOpenOutlinedIcon />
            </Fab >

          </Grid >
          <Grid item xs={12}>
            <Fab
              size="small"
              className={classes.fab}
              onClick={handleToggleClipping}
            >
              <CropIcon />
            </Fab>

          </Grid>
          <Grid item xs={12}>
            <Fab
              size="small"
              className={classes.fab}
              onClick={handleShowSpatialStructure}
            >
              <AccountTreeIcon />
            </Fab>
          </Grid>
          <Grid item xs={12}>
            <Fab
              size="small"
              className={classes.fab}
              onClick={handleShowProperties}
            >
              <DescriptionIcon />
            </Fab>
          </Grid>
        </Grid >
        <Grid item xs={10}>
          <div
            id='viewer-container'
            style={{ position: 'absolute', height: '100%', width: '100%', left: '0', top: '0' }}
            onClick={handleClick}
          />
          <Dropzone ref={dropzoneRef} onDrop={onDrop}>
            {({ getRootProps, getInputProps }) => (
              <div {...getRootProps({ className: 'dropzone' })}>
                <input {...getInputProps()} accept='.ifc' />
              </div>
            )}
          </Dropzone>
        </Grid>
      </Grid >
      <Backdrop
        style={{
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          alignContent: "center"
        }}
        open={isLoading}
      >
        <CircularProgress color='inherit' />
        {`${percentageLoading} %`}
      </Backdrop>

    </>
  );

}

export default IfcRenderer;
