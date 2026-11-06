import { BranchClient } from '../branch-client.js';
import { BranchServer } from '../branch-server.js';
import { SimulatedNetwork } from '../simulated-network.js';

const BRANCH_ID = 'mindmap-branch-1';
const ROOT_ID = 'branch-root-1';

// Initialize server and simulated network
const server = new BranchServer();
const network = new SimulatedNetwork(server);

// Initialize 3 clients
const clientConfigs = [
  { index: 1, id: 'client-1', name: 'Alice' },
  { index: 2, id: 'client-2', name: 'Bob' },
  { index: 3, id: 'client-3', name: 'Charlie' },
];

const clients: Map<string, BranchClient> = new Map();

for (const cfg of clientConfigs) {
  const client = new BranchClient({
    clientId: cfg.id,
    branchId: BRANCH_ID,
    branchRootId: ROOT_ID,
  });
  clients.set(cfg.id, client);
}

// Initial server sync to establish the branch
const c1 = clients.get('client-1')!;
network.syncClient(c1, ROOT_ID);
network.syncAllOnline(Array.from(clients.values()), ROOT_ID);

// Listen to sync events: if client X pushes changes or has rejections, log and propagate
network.onSync(({ clientId, response }) => {
  if (response.acceptedOpIds.length > 0) {
    logMessage(
      clientId,
      `Committed to server (head rev: ${response.headRevision}, +${response.acceptedOpIds.length} pushed)`,
      'sync'
    );
  }

  if (response.rejectedOps.length > 0) {
    const reasons = response.rejectedOps.map(r => `${r.opId}: ${r.reason}`).join(', ');
    logMessage(
      clientId,
      `⚠️ Server rejected ${response.rejectedOps.length} op(s) [${reasons}] — reverted local tree`,
      'error'
    );
  }

  if (response.remoteOperations.length > 0) {
    logMessage(
      clientId,
      `Pulled ${response.remoteOperations.length} remote op(s) (head rev: ${response.headRevision})`,
      'sync'
    );
  }

  // Propagate to other online clients only if new operations were committed to the server
  if (response.acceptedOpIds.length > 0) {
    for (const client of clients.values()) {
      if (client.clientId !== clientId && network.isClientOnline(client.clientId)) {
        const pullRes = network.syncClient(client, ROOT_ID);
        if (pullRes.response && pullRes.response.remoteOperations.length > 0) {
          logMessage(
            client.clientId,
            `Pulled ${pullRes.response.remoteOperations.length} remote op(s) (head rev: ${pullRes.response.headRevision})`,
            'sync'
          );
        }
      }
    }
  }

  scheduleRender();
});

function logMessage(
  clientId: string,
  msg: string,
  type: 'info' | 'sync' | 'edit' | 'error' = 'info'
): void {
  const cfg = clientConfigs.find(c => c.id === clientId);
  if (!cfg) return;

  const logContainer = document.getElementById(`log-${cfg.index}`);
  if (!logContainer) return;

  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${time}] ${msg}`;

  logContainer.prepend(entry);

  while (logContainer.children.length > 50) {
    logContainer.removeChild(logContainer.lastChild!);
  }
}

// Batched rendering using requestAnimationFrame to prevent DOM thrashing
let renderScheduled = false;
function scheduleRender(): void {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    renderAll();
  });
}

function renderTree(client: BranchClient, parentId: string): HTMLElement {
  const container = document.createElement('div');
  container.className = 'tree-children-container';

  const children = client.getChildren(parentId);
  for (const child of children) {
    const nodeItem = document.createElement('div');
    nodeItem.className = 'tree-node-item';

    const card = document.createElement('div');
    card.className = 'tree-node-card';

    // Editable title input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'node-content-input';
    input.value = child.content;
    input.dataset.clientId = client.clientId;
    input.dataset.nodeId = child.id;

    input.addEventListener('change', () => {
      const newContent = input.value.trim();
      if (newContent && newContent !== child.content) {
        client.updateNode(child.id, newContent);
        logMessage(client.clientId, `Edited node "${child.id}" to "${newContent}"`, 'edit');

        if (network.isClientOnline(client.clientId)) {
          network.syncClient(client, ROOT_ID);
        }
        scheduleRender();
      }
    });

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        input.blur();
      }
    });

    card.appendChild(input);

    // Node action buttons
    const actions = document.createElement('div');
    actions.className = 'node-actions';

    // + Subtopic
    const btnAddChild = document.createElement('button');
    btnAddChild.className = 'btn-icon';
    btnAddChild.title = 'Add Subtopic';
    btnAddChild.textContent = '+ Sub';
    btnAddChild.addEventListener('click', () => {
      const newNode = client.createNode({
        parentId: child.id,
      });
      logMessage(client.clientId, `Added child "${newNode.content}" (${newNode.id}) under "${child.content}"`, 'edit');

      if (network.isClientOnline(client.clientId)) {
        network.syncClient(client, ROOT_ID);
      }
      scheduleRender();
    });
    actions.appendChild(btnAddChild);

    // + Sibling
    const btnAddSibling = document.createElement('button');
    btnAddSibling.className = 'btn-icon';
    btnAddSibling.title = 'Add Sibling';
    btnAddSibling.textContent = '+ Sib';
    btnAddSibling.addEventListener('click', () => {
      const newNode = client.createNode({
        parentId: child.parentId!,
        afterNodeId: child.id,
      });
      logMessage(client.clientId, `Added sibling "${newNode.content}" (${newNode.id}) after "${child.content}"`, 'edit');

      if (network.isClientOnline(client.clientId)) {
        network.syncClient(client, ROOT_ID);
      }
      scheduleRender();
    });
    actions.appendChild(btnAddSibling);

    // Move dropdown
    const moveSelect = document.createElement('select');
    moveSelect.className = 'btn-icon move-select';
    moveSelect.title = 'Move Node to New Parent';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Move...';
    defaultOpt.selected = true;
    defaultOpt.disabled = true;
    moveSelect.appendChild(defaultOpt);

    const allNodes = Array.from(client.getWorkingTree().nodes.values()).filter(
      n => !n.isDeleted && n.id !== child.id && n.id !== child.parentId
    );

    for (const candidate of allNodes) {
      const opt = document.createElement('option');
      opt.value = candidate.id;
      const isCycle = client.wouldCreateCycle(child.id, candidate.id);
      const label = candidate.id === ROOT_ID ? '🌟 Root' : candidate.content;
      if (isCycle) {
        opt.textContent = `🚫 ${label} (cycle)`;
        opt.disabled = true;
      } else {
        opt.textContent = `↳ ${label}`;
      }
      moveSelect.appendChild(opt);
    }

    moveSelect.addEventListener('change', () => {
      const targetParentId = moveSelect.value;
      if (targetParentId && client.getWorkingTree().nodes.has(targetParentId)) {
        const targetNode = client.getWorkingTree().nodes.get(targetParentId);
        const targetLabel = targetParentId === ROOT_ID ? 'Root' : targetNode?.content ?? targetParentId;
        const moved = client.moveNode(child.id, targetParentId);
        if (moved) {
          logMessage(
            client.clientId,
            `Moved "${child.content}" under "${targetLabel}"`,
            'edit'
          );

          if (network.isClientOnline(client.clientId)) {
            network.syncClient(client, ROOT_ID);
          }
        } else {
          logMessage(
            client.clientId,
            `⚠️ Blocked move of "${child.content}" under "${targetLabel}" (would create cycle)`,
            'error'
          );
        }
        scheduleRender();
      }
    });
    actions.appendChild(moveSelect);

    // Delete button
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-icon btn-danger';
    btnDelete.title = 'Delete Node';
    btnDelete.textContent = '✕';
    btnDelete.addEventListener('click', () => {
      client.deleteNode(child.id);
      logMessage(client.clientId, `Deleted node "${child.id}"`, 'edit');

      if (network.isClientOnline(client.clientId)) {
        network.syncClient(client, ROOT_ID);
      }
      scheduleRender();
    });
    actions.appendChild(btnDelete);

    card.appendChild(actions);
    nodeItem.appendChild(card);

    // Render descendants recursively
    const childSubtree = renderTree(client, child.id);
    if (childSubtree.children.length > 0) {
      nodeItem.appendChild(childSubtree);
    }

    container.appendChild(nodeItem);
  }

  return container;
}

function renderClientPanel(cfg: { index: number; id: string; name: string }): void {
  const client = clients.get(cfg.id)!;
  const isOnline = network.isClientOnline(cfg.id);
  const panel = document.getElementById(`panel-client-${cfg.index}`);
  const treeContainer = document.getElementById(`tree-container-${cfg.index}`);
  const statusBadge = document.getElementById(`status-badge-${cfg.index}`);
  const uncommittedBadge = document.getElementById(`uncommitted-badge-${cfg.index}`);
  const statsSpan = document.getElementById(`stats-${cfg.index}`);
  const toggle = document.getElementById(`toggle-online-${cfg.index}`) as HTMLInputElement;

  if (!panel || !treeContainer || !statusBadge || !uncommittedBadge || !statsSpan || !toggle) return;

  toggle.checked = isOnline;
  panel.classList.toggle('is-offline', !isOnline);

  statusBadge.className = `status-badge ${isOnline ? 'online' : 'offline'}`;
  statusBadge.textContent = isOnline ? 'Online' : 'Offline';

  const uncommittedOps = client.prepareSync().operations;
  const uncommittedCount = uncommittedOps.length;

  uncommittedBadge.className = `uncommitted-badge ${uncommittedCount > 0 ? 'dirty' : 'clean'}`;
  uncommittedBadge.textContent = `${uncommittedCount} uncommitted`;

  statsSpan.textContent = `Rev: ${client.prepareSync().baseRevision} | Ops: ${client.getWorkingTree().nodes.size} nodes`;

  // Render tree
  treeContainer.innerHTML = '';

  const rootItem = document.createElement('div');
  rootItem.className = 'tree-node-item is-root';

  const rootCard = document.createElement('div');
  rootCard.className = 'tree-node-card root-card';

  const rootTitle = document.createElement('span');
  rootTitle.textContent = '🌟 Central Topic (Root)';
  rootTitle.style.flex = '1';
  rootCard.appendChild(rootTitle);

  const rootBtnAdd = document.createElement('button');
  rootBtnAdd.className = 'btn-icon';
  rootBtnAdd.textContent = '+ Subtopic';
  rootBtnAdd.addEventListener('click', () => {
    const newNode = client.createNode({
      parentId: ROOT_ID,
    });
    logMessage(client.clientId, `Added topic "${newNode.content}" (${newNode.id}) under Root`, 'edit');

    if (network.isClientOnline(client.clientId)) {
      network.syncClient(client, ROOT_ID);
    }
    scheduleRender();
  });
  rootCard.appendChild(rootBtnAdd);
  rootItem.appendChild(rootCard);

  const rootChildren = renderTree(client, ROOT_ID);
  rootItem.appendChild(rootChildren);

  treeContainer.appendChild(rootItem);
}

function updateServerStats(): void {
  const branch = server.getBranch(BRANCH_ID);
  const revElem = document.getElementById('server-rev-val');
  const opsElem = document.getElementById('server-ops-val');

  if (revElem) revElem.textContent = String(branch?.revision ?? 0);
  if (opsElem) opsElem.textContent = String(branch?.opLog.length ?? 0);
}

function renderAll(): void {
  // Save focus position if user is typing
  let focusedInfo: { clientId: string; nodeId: string; pos: number | null } | null = null;
  const active = document.activeElement as HTMLInputElement | null;
  if (active && active.dataset.nodeId && active.dataset.clientId) {
    focusedInfo = {
      clientId: active.dataset.clientId,
      nodeId: active.dataset.nodeId,
      pos: active.selectionStart,
    };
  }

  for (const cfg of clientConfigs) {
    renderClientPanel(cfg);
  }
  updateServerStats();

  // Restore focus seamlessly
  if (focusedInfo) {
    const matching = document.querySelector<HTMLInputElement>(
      `input[data-client-id="${focusedInfo.clientId}"][data-node-id="${focusedInfo.nodeId}"]`
    );
    if (matching) {
      matching.focus();
      if (focusedInfo.pos !== null) {
        matching.setSelectionRange(focusedInfo.pos, focusedInfo.pos);
      }
    }
  }
}

// Bind event listeners for headers and toggles
for (const cfg of clientConfigs) {
  const toggle = document.getElementById(`toggle-online-${cfg.index}`) as HTMLInputElement;
  const btnSync = document.getElementById(`btn-sync-${cfg.index}`);

  if (toggle) {
    toggle.addEventListener('change', () => {
      const isOnline = toggle.checked;
      network.setClientOnline(cfg.id, isOnline);
      logMessage(cfg.id, `Toggled connection: ${isOnline ? 'ONLINE' : 'OFFLINE'}`, isOnline ? 'sync' : 'error');

      if (isOnline) {
        const client = clients.get(cfg.id)!;
        network.syncClient(client, ROOT_ID);
      }
      scheduleRender();
    });
  }

  if (btnSync) {
    btnSync.addEventListener('click', () => {
      const client = clients.get(cfg.id)!;
      if (!network.isClientOnline(cfg.id)) {
        alert(`${cfg.name} is currently offline! Toggle to online first.`);
        return;
      }
      network.syncClient(client, ROOT_ID);
      scheduleRender();
    });
  }
}

// Global action: Sync All Online
const btnSyncAll = document.getElementById('btn-sync-all');
if (btnSyncAll) {
  btnSyncAll.addEventListener('click', () => {
    network.syncAllOnline(Array.from(clients.values()), ROOT_ID);
    scheduleRender();
  });
}

// Global action: Seed Sample Topics
const btnSeed = document.getElementById('btn-seed');
if (btnSeed) {
  btnSeed.addEventListener('click', () => {
    const c1 = clients.get('client-1')!;

    const t1 = c1.createNode({ parentId: ROOT_ID, content: '🥕 Vegetables & Herbs' });
    c1.createNode({ parentId: t1.id, content: 'Heirloom Tomatoes' });
    c1.createNode({ parentId: t1.id, content: 'Fresh Basil & Mint' });
    c1.createNode({ parentId: t1.id, content: 'Root Crops (Carrots & Beets)' });

    const t2 = c1.createNode({ parentId: ROOT_ID, content: '🌸 Flowers & Pollinators' });
    c1.createNode({ parentId: t2.id, content: 'English Lavender' });
    c1.createNode({ parentId: t2.id, content: 'Wildflower Meadow' });

    const t3 = c1.createNode({ parentId: ROOT_ID, content: '🪴 Soil & Composting' });
    c1.createNode({ parentId: t3.id, content: 'Organic Compost Bin' });
    c1.createNode({ parentId: t3.id, content: 'Worm Farm & Castings' });

    logMessage('client-1', 'Seeded gardening mindmap hierarchy', 'edit');

    if (network.isClientOnline('client-1')) {
      network.syncClient(c1, ROOT_ID);
    }
    scheduleRender();
  });
}


// Initial render
renderAll();
