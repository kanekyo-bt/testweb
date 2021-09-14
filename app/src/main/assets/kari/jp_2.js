function setupScene(vrm_parent){
	// renderer
  window.renderer = new THREE.WebGLRenderer();
  renderer.setSize(320, 240);
  renderer.setPixelRatio(window.devicePixelRatio);
  vrm_parent.appendChild(renderer.domElement);

	// camera
  window.camera = new THREE.PerspectiveCamera(50.0, 4.0 / 3.0, 0.1, 5.0);

	//scene
  window.scene = new THREE.Scene();

	//light
  scene.add(new THREE.DirectionalLight(0xffffff));

	//load
  new THREE.GLTFLoader().load(
    "https://pixiv.github.io/three-vrm/examples/models/three-vrm-girl.vrm",
    initVRM, 
    progress => console.log("Loading model...",100.0 * (progress.loaded / progress.total),"%"),
    console.error
  );
}

//�ʒu�̏�����(�t�F�C�X�g���b�L���O�͂��ĂȂ�)
async function initVRM(gltf) {
  window.vrm = await THREE.VRM.from(gltf);
  scene.add(vrm.scene);
  vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.Hips).rotation.y = Math.PI;
  vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.LeftUpperArm).rotation.z = Math.PI * 2 / 5;
  vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.RightUpperArm).rotation.z = -Math.PI * 2 / 5;
  const head = vrm.humanoid.getBoneNode( THREE.VRMSchema.HumanoidBoneName.Head );
  camera.position.set( 0.0, head.getWorldPosition(new THREE.Vector3()).y + 0.05, 0.5 );
  window.clock = new THREE.Clock();
  clock.start();
  renderer.render(scene, camera);
}

//web�J�����̐ݒ�
async function setupCamera(videoElement) {
  const constraints = {video: {width: 320,height: 240}, audio: false};
  const stream = await navigator.mediaDevices.getUserMedia(constraints);//web�J�����̎g�p&�f�[�^���o��
  videoElement.srcObject = stream;				//web�J�����f�[�^��html�̗v�f�ɑ��
  return new Promise(resolve => {					//�ȉ��ҋ@����
    videoElement.onloadedmetadata = () => {
      videoElement.play();
      resolve();
    };
  });
}

//�t�F�C�X�g���b�L���O(�񓮂����p)
function estimatePose(annotations) {
  const faces = annotations.silhouette;
  const x1 = new THREE.Vector3().fromArray(faces[9]);		//���x���o��
  const x2 = new THREE.Vector3().fromArray(faces[27]);	//���x���o��
  const y1 = new THREE.Vector3().fromArray(faces[18]);	//���y���o��
  const y2 = new THREE.Vector3().fromArray(faces[0]);		//���y���o��
  const xaxis = x2.sub(x1).normalize();									//��̉����x�N�g�����o��
  const yaxis = y2.sub(y1).normalize();									//��̏c���x�N�g�����o��

	//�N�H�[�^�j�I���ɕϊ�
  const zaxis = new THREE.Vector3().crossVectors(xaxis, yaxis);
  const mat = new THREE.Matrix4().makeBasis(xaxis, yaxis, zaxis).premultiply(
    new THREE.Matrix4().makeRotationZ(Math.PI)
  );
  return new THREE.Quaternion().setFromRotationMatrix(mat);
}


//�`��
function startRender(input, output, model) {
  const ctx = output.getContext("2d");
  async function renderFrame() {
    requestAnimationFrame(renderFrame);				//���[�v����
    vrm.update(clock.getDelta());							//���[�v�X�V

		//��̍X�V
    const faces = await model.estimateFaces(input, false, false);	//�猟�o�����ƌ��ʎ擾(�t�F)
    ctx.clearRect(0, 0, output.width, output.height);
    faces.forEach(face => {
      face.scaledMesh.forEach(xy => {
        ctx.beginPath();
        ctx.arc(xy[0], xy[1], 1, 0, 2 * Math.PI);
        ctx.fill();
      });
      const annotations = face.annotations;
      const q = estimatePose(annotations);
      const head = vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.Head);//��̈ʒu���o��?
      head.quaternion.slerp(q, 0.1);//�ݒ肵����̈ʒu��ύX?
      const blink = Math.max( 0.0, 1.0 - 10.0 * Math.abs( ( clock.getElapsedTime() % 4.0 ) - 2.0 ) );//�u���̊Ԋu
      vrm.blendShapeProxy.setValue(THREE.VRMSchema.BlendShapePresetName.Blink, blink);//�u���`��
      const lipsLowerInner = annotations.lipsLowerInner[5];			//���̉����o��
      const lipsUpperInner = annotations.lipsUpperInner[5];			//���̏���o��
      const expressionA = Math.max(0, Math.min(1, (lipsLowerInner[1] - lipsUpperInner[1])/10.0));		//���̕`�ʂ̌v�Z
      vrm.blendShapeProxy.setValue(THREE.VRMSchema.BlendShapePresetName.A, expressionA);						//���̕`��
    });
    renderer.render(scene, camera);
  }
  renderFrame();
}

//���[�f�B���O�A�C�R���\��
function loading(onoff) {
  document.getElementById("loadingicon").style.display = onoff ? "inline" : "none";
}

//���C���֐�
async function start() {
  const input = document.getElementById("input");
  const output = document.getElementById("output");
  const vrm_parent = document.getElementById("vrm_parent");
  loading(true);
  setupScene(vrm_parent);
  await setupCamera(input);
  const model = await facemesh.load({ maxFaces: 1 });
  startRender(input, output, model);
  loading(false);
}