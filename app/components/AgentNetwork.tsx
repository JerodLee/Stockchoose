'use client';
import { useEffect, useRef, useState } from 'react';

interface Node {
  id: number; x: number; y: number; r: number;
  cluster: 'bear' | 'bull' | 'neutral' | 'hub';
  label?: string; vx: number; vy: number;
}
interface Edge { a: number; b: number; }

const BEAR_NAMES = ['ALARABISK','BULLMARKET','BEARFLAG','REKTBOT','SHORTSELL','CRABWAVE','FUDMASTER','DUMPIT','PANIC','SELLOFF'];
const BULL_NAMES = ['MOONLORD','ALPHASEEK','BTCBULL','HODLER','DIAMND','ROCKETMAN','PUMPIT','GREEDIDX','MACDCROSS','TOOTHEMOON','BULLRUN','FOMO','LONGGANG','LEVERAGED','WENMOON'];

function genCluster(
  cx: number, cy: number, count: number, radius: number,
  cluster: Node['cluster'], names: string[] = []
): Node[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.8;
    const r2 = (0.3 + Math.random() * 0.7) * radius;
    return {
      id: i, x: cx + Math.cos(angle) * r2, y: cy + Math.sin(angle) * r2,
      r: cluster === 'hub' ? 10 + Math.random() * 8 : 3 + Math.random() * 5,
      cluster, label: names[i] || undefined,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
    };
  });
}

function genEdges(nodes: Node[], cluster: Node['cluster'], extra: number[][]): Edge[] {
  const edges: Edge[] = [];
  const clusterNodes = nodes.filter(n => n.cluster === cluster).map((_, i) => nodes.indexOf(_));
  // intra-cluster
  for (let i = 0; i < clusterNodes.length - 1; i++) {
    if (Math.random() > 0.4) edges.push({ a: clusterNodes[i], b: clusterNodes[i + 1] });
    if (i < clusterNodes.length - 3 && Math.random() > 0.6)
      edges.push({ a: clusterNodes[i], b: clusterNodes[i + 2] });
  }
  // cross-cluster
  extra.forEach(([a, b]) => edges.push({ a, b }));
  return edges;
}

export default function AgentNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [trophy, setTrophy] = useState(529);
  const [trophyDelta] = useState(5);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const id = setInterval(() => setTrophy(t => t + Math.floor(Math.random() * 3)), 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W; canvas.height = H;

    // Build nodes
    const bearNodes = genCluster(W * 0.22, H * 0.45, 12, H * 0.28, 'bear', BEAR_NAMES);
    const bullNodes = genCluster(W * 0.65, H * 0.38, 15, H * 0.30, 'bull', BULL_NAMES);
    const neutNodes = genCluster(W * 0.45, H * 0.72, 8, H * 0.18, 'neutral');
    const hubNodes = genCluster(W * 0.42, H * 0.44, 3, H * 0.06, 'hub');
    const allNodes = [...bearNodes, ...bullNodes, ...neutNodes, ...hubNodes];

    // Assign global IDs
    allNodes.forEach((n, i) => { n.id = i; });

    const bearIdx = bearNodes.map((_, i) => i);
    const bullIdx = bullNodes.map((_, i) => i + bearNodes.length);
    const neutIdx = neutNodes.map((_, i) => i + bearNodes.length + bullNodes.length);
    const hubIdx = hubNodes.map((_, i) => i + bearNodes.length + bullNodes.length + neutNodes.length);

    // Edges
    const edges: Edge[] = [];
    // Intra-cluster
    const addIntra = (indices: number[]) => {
      for (let i = 0; i < indices.length - 1; i++) {
        if (Math.random() > 0.35) edges.push({ a: indices[i], b: indices[i + 1] });
        if (i < indices.length - 2 && Math.random() > 0.5)
          edges.push({ a: indices[i], b: indices[i + 2] });
      }
    };
    addIntra(bearIdx); addIntra(bullIdx); addIntra(neutIdx);
    // Cross edges to hub
    bearIdx.slice(0, 4).forEach(i => edges.push({ a: i, b: hubIdx[0] }));
    bullIdx.slice(0, 5).forEach(i => edges.push({ a: i, b: hubIdx[1] }));
    neutIdx.slice(0, 3).forEach(i => edges.push({ a: i, b: hubIdx[2] }));
    // Cross bear-bull
    edges.push({ a: bearIdx[2], b: bullIdx[3] });
    edges.push({ a: bearIdx[5], b: bullIdx[8] });

    const CLUSTER_COLORS: Record<Node['cluster'], string> = {
      bear: '#ff1744', bull: '#448aff', neutral: '#00e676', hub: '#333',
    };

    let frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Animate nodes
      allNodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        // soft bounds
        if (n.x < n.r || n.x > W - n.r) n.vx *= -1;
        if (n.y < n.r || n.y > H - n.r) n.vy *= -1;
      });

      // Draw edges
      edges.forEach(e => {
        const a = allNodes[e.a], b = allNodes[e.b];
        if (!a || !b) return;
        const phase = (frame * 0.02 + e.a * 0.1) % 1;
        const alpha = 0.05 + Math.abs(Math.sin(phase * Math.PI)) * 0.35;
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Draw nodes
      allNodes.forEach(n => {
        const color = CLUSTER_COLORS[n.cluster];
        const pulse = n.cluster === 'hub' ? 1 + 0.15 * Math.sin(frame * 0.05 + n.id) : 1;
        const r = n.r * pulse;

        // Glow
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3);
        grad.addColorStop(0, color + '44');
        grad.addColorStop(1, color + '00');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 3, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = n.cluster === 'hub' ? '#111' : color + 'cc';
        ctx.strokeStyle = color;
        ctx.lineWidth = n.cluster === 'hub' ? 1.5 : 0.8;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Label for named nodes
        if (n.label && n.r > 4) {
          ctx.fillStyle = color + 'aa';
          ctx.font = '7px Courier New';
          ctx.fillText(n.label, n.x + r + 2, n.y + 3);
        }
      });

      // Cluster labels
      [
        { x: W * 0.05, y: H * 0.1, label: '● BEAR CLUSTER', color: '#ff174488' },
        { x: W * 0.55, y: H * 0.08, label: '● BULL CLUSTER', color: '#448aff88' },
        { x: W * 0.35, y: H * 0.92, label: '● NEUTRAL', color: '#00e67688' },
      ].forEach(({ x, y, label, color }) => {
        ctx.fillStyle = color;
        ctx.font = '9px Courier New';
        ctx.fillText(label, x, y);
      });

      frame++;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div className="panel flex flex-col h-full" style={{ position: 'relative' }}>
      <div className="panel-header justify-between">
        <span>● AGENTS BOARD · BTC GRAPH</span>
        <span style={{ color: '#444' }}>TWEET WHAT? TIPS #1</span>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

        {/* Trophy overlay */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#111c', border: '1px solid #2a2a2a',
          padding: '8px 16px', textAlign: 'center', pointerEvents: 'none',
          animation: 'trophy-flash 2s ease-in-out infinite',
        }}>
          <div style={{ color: '#00e676', fontSize: 9, marginBottom: 2 }}>▲ TROPHY UNLOCKED</div>
          <div style={{ color: '#ffd740', fontSize: 22, fontWeight: 'bold', fontFamily: 'Courier New' }}>
            +${trophyDelta} <span className="white">{trophy}</span>
          </div>
          <div style={{ color: '#333', fontSize: 8, marginTop: 2 }}>TOTAL TROPHIES THIS CYCLE</div>
        </div>
      </div>
    </div>
  );
}
