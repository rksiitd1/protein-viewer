import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { PDBLoader } from 'three/examples/jsm/loaders/PDBLoader';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Input } from "../../components/ui/input"

const ProteinViewer = () => {
  const mount = useRef(null);
  const [protein, setProtein] = useState('1crn');
  const [scene, setScene] = useState(null);
  const [camera, setCamera] = useState(null);
  const [renderer, setRenderer] = useState(null);
  const [labelRenderer, setLabelRenderer] = useState(null);
  const [controls, setControls] = useState(null);
  const [atoms, setAtoms] = useState([]);
  const [bonds, setBonds] = useState([]);
  const [aminoAcids, setAminoAcids] = useState({});
  const [colorBy, setColorBy] = useState('element');
  const [bondThreshold, setBondThreshold] = useState(2.5);
  const [showLabels, setShowLabels] = useState(false);

  useEffect(() => {
    if (!mount.current) return;

    const width = mount.current.clientWidth;
    const height = mount.current.clientHeight;

    const newScene = new THREE.Scene();
    const newCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const newRenderer = new THREE.WebGLRenderer();
    const newLabelRenderer = new CSS2DRenderer();

    newRenderer.setSize(width, height);
    newLabelRenderer.setSize(width, height);
    mount.current.appendChild(newRenderer.domElement);
    mount.current.appendChild(newLabelRenderer.domElement);

    const newControls = new OrbitControls(newCamera, newLabelRenderer.domElement);
    newCamera.position.z = 50;

    setScene(newScene);
    setCamera(newCamera);
    setRenderer(newRenderer);
    setLabelRenderer(newLabelRenderer);
    setControls(newControls);

    return () => {
      mount.current.removeChild(newRenderer.domElement);
      mount.current.removeChild(newLabelRenderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!scene || !camera || !renderer || !controls) return;

    const loader = new PDBLoader();
    loader.load(`https://files.rcsb.org/view/${protein}.pdb`, (pdb) => {
      scene.remove.apply(scene, scene.children);
      const geometryAtoms = pdb.geometryAtoms;
      const geometryBonds = pdb.geometryBonds;
      const json = pdb.json;

      const atomPositions = geometryAtoms.getAttribute('position').array;
      const atomColors = geometryAtoms.getAttribute('color').array;
      const newAtoms = [];
      const newAminoAcids = {};

      for (let i = 0; i < atomPositions.length; i += 3) {
        const atom = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 16, 16),
          new THREE.MeshPhongMaterial({ color: new THREE.Color(atomColors[i], atomColors[i+1], atomColors[i+2]) })
        );
        atom.position.set(atomPositions[i], atomPositions[i+1], atomPositions[i+2]);
        newAtoms.push(atom);
        scene.add(atom);

        if (showLabels) {
          const atomData = json.atoms[i/3];
          const label = document.createElement('div');
          label.textContent = atomData.element;
          label.style.color = 'white';
          label.style.fontSize = '8px';
          const labelObject = new CSS2DObject(label);
          labelObject.position.set(atomPositions[i], atomPositions[i+1], atomPositions[i+2]);
          scene.add(labelObject);
        }

        const residue = json.atoms[i/3].residue;
        if (!newAminoAcids[residue]) {
          newAminoAcids[residue] = 1;
        } else {
          newAminoAcids[residue]++;
        }
      }

      setAtoms(newAtoms);
      setAminoAcids(newAminoAcids);

      const bondPositions = geometryBonds.getAttribute('position').array;
      const newBonds = [];

      for (let i = 0; i < bondPositions.length; i += 6) {
        const start = new THREE.Vector3(bondPositions[i], bondPositions[i+1], bondPositions[i+2]);
        const end = new THREE.Vector3(bondPositions[i+3], bondPositions[i+4], bondPositions[i+5]);

        if (start.distanceTo(end) < bondThreshold) {
          const bondGeometry = new THREE.CylinderGeometry(0.1, 0.1, start.distanceTo(end));
          const bondMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
          const bond = new THREE.Mesh(bondGeometry, bondMaterial);

          const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
          bond.position.copy(center);
          bond.lookAt(end);
          bond.rotateX(Math.PI / 2);

          newBonds.push(bond);
          scene.add(bond);
        }
      }

      setBonds(newBonds);

      const light = new THREE.PointLight(0xffffff, 1, 100);
      light.position.set(0, 0, 10);
      scene.add(light);

      camera.lookAt(scene.position);
      controls.update();

      const animate = () => {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
      };
      animate();
    });
  }, [scene, camera, renderer, controls, protein, bondThreshold, showLabels]);

  const handleColorChange = (newColorBy) => {
    setColorBy(newColorBy);
    atoms.forEach((atom, index) => {
      let color;
      if (newColorBy === 'element') {
        color = new THREE.Color(atom.material.color);
      } else if (newColorBy === 'chain') {
        color = new THREE.Color(Math.random(), Math.random(), Math.random());
      }
      atom.material.color = color;
    });
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-grow" ref={mount}></div>
      <div className="p-4 bg-gray-100">
        <div className="flex space-x-4 mb-4">
          <Select onValueChange={setProtein} value={protein}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select protein" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1crn">Crambin (1CRN)</SelectItem>
              <SelectItem value="1ake">Adenylate Kinase (1AKE)</SelectItem>
              <SelectItem value="1gfl">Green Fluorescent Protein (1GFL)</SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={handleColorChange} value={colorBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Color by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="element">Element</SelectItem>
              <SelectItem value="chain">Chain</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center space-x-2">
            <span>Bond Threshold:</span>
            <Input
              type="number"
              value={bondThreshold}
              onChange={(e) => setBondThreshold(parseFloat(e.target.value))}
              className="w-20"
            />
          </div>
          <Button onClick={() => setShowLabels(!showLabels)}>
            {showLabels ? 'Hide Labels' : 'Show Labels'}
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Amino Acid Composition</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(aminoAcids).map(([aa, count]) => (
                <div key={aa} className="flex justify-between">
                  <span>{aa}:</span>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProteinViewer;
