import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import type { CSSProperties } from "react";
import {
  BarChart3,
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  History,
  MapPinned,
  PackageCheck,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Undo2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { voiceTimeline } from "./generatedVoiceTimeline";

const colors = {
  bg: "#050816",
  text: "#f8fafc",
  muted: "#cbd5e1",
  border: "rgba(226, 232, 240, 0.22)",
  panel: "rgba(2, 6, 23, 0.74)",
  primary: "#38bdf8",
  emerald: "#34d399",
  amber: "#fbbf24",
  rose: "#fb7185",
  violet: "#a78bfa",
};

type Scene = {
  id: string;
  title: string;
  subtitle: string;
  screenshot: string;
  icon: LucideIcon;
  color: string;
  focus: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    delay?: number;
  }>;
};

export type PromoVideoProps = {
  avatarVideoPath?: string;
  showAvatar?: boolean;
};

const scenes: Scene[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    subtitle: "KPIs, ventas, clientes, alertas y rendimiento desde la vista real.",
    screenshot: "dashboard.png",
    icon: BarChart3,
    color: colors.primary,
    focus: [
      { x: 312, y: 202, w: 1186, h: 188, label: "KPIs del negocio", delay: 24 },
      { x: 312, y: 482, w: 1584, h: 338, label: "Rendimiento diario", delay: 118 },
    ],
  },
  {
    id: "pos",
    title: "Punto de venta",
    subtitle: "Busqueda de productos, carrito, contado, credito y ticket.",
    screenshot: "pos.png",
    icon: Receipt,
    color: colors.emerald,
    focus: [
      { x: 318, y: 150, w: 760, h: 74, label: "Busqueda rapida", delay: 26 },
      { x: 1280, y: 155, w: 575, h: 780, label: "Venta lista para cobrar", delay: 132 },
    ],
  },
  {
    id: "sales",
    title: "Historial de ventas",
    subtitle: "Transacciones, filtros, totales y descarga de ticket PDF.",
    screenshot: "sales.png",
    icon: DollarSign,
    color: colors.amber,
    focus: [
      { x: 252, y: 210, w: 1310, h: 150, label: "Totales por filtro", delay: 24 },
      { x: 252, y: 508, w: 1314, h: 332, label: "Historial y PDF", delay: 126 },
    ],
  },
  {
    id: "cash",
    title: "Caja diaria",
    subtitle: "Apertura, cierre, ingresos, egresos y control por turno.",
    screenshot: "cash.png",
    icon: DollarSign,
    color: colors.emerald,
    focus: [
      { x: 312, y: 190, w: 1260, h: 170, label: "Resumen de caja", delay: 22 },
      { x: 312, y: 392, w: 720, h: 300, label: "Ingresos y egresos", delay: 102 },
    ],
  },
  {
    id: "returns",
    title: "Devoluciones",
    subtitle: "Registro, aprobacion, conclusion, stock, caja y auditoria.",
    screenshot: "returns.png",
    icon: Undo2,
    color: colors.rose,
    focus: [
      { x: 315, y: 164, w: 1580, h: 128, label: "Estado del flujo", delay: 20 },
      { x: 316, y: 392, w: 1576, h: 560, label: "Devoluciones trazables", delay: 134 },
    ],
  },
  {
    id: "stock",
    title: "Stock actual",
    subtitle: "Existencias reales por producto y tienda.",
    screenshot: "stock.png",
    icon: PackageCheck,
    color: colors.emerald,
    focus: [
      { x: 312, y: 176, w: 740, h: 92, label: "Filtros por tienda", delay: 18 },
      { x: 312, y: 368, w: 1580, h: 502, label: "Stock por producto", delay: 90 },
    ],
  },
  {
    id: "movements",
    title: "Movimientos",
    subtitle: "Entradas, salidas, ajustes y devoluciones trazables.",
    screenshot: "movements.png",
    icon: History,
    color: colors.primary,
    focus: [
      { x: 315, y: 232, w: 1470, h: 88, label: "Filtros de movimiento", delay: 26 },
      { x: 315, y: 392, w: 1470, h: 500, label: "Historial auditable", delay: 118 },
    ],
  },
  {
    id: "catalog",
    title: "Revista de productos",
    subtitle: "Catalogo visual por modelos, colores y variantes.",
    screenshot: "visual-catalog.png",
    icon: ShoppingBag,
    color: colors.violet,
    focus: [
      { x: 312, y: 150, w: 1450, h: 104, label: "Catalogo filtrable", delay: 22 },
      { x: 312, y: 300, w: 1540, h: 600, label: "Modelos y variantes", delay: 106 },
    ],
  },
  {
    id: "clients",
    title: "Clientes y cobranzas",
    subtitle: "Cartera, deuda, pagos, seguimiento y riesgo.",
    screenshot: "clients-dashboard.png",
    icon: Users,
    color: colors.primary,
    focus: [
      { x: 312, y: 184, w: 1280, h: 170, label: "Cartera en resumen", delay: 20 },
      { x: 312, y: 430, w: 760, h: 360, label: "Riesgo y seguimiento", delay: 104 },
    ],
  },
  {
    id: "credit",
    title: "Planes de credito",
    subtitle: "Cuotas, vencimientos, saldos y prioridad de cobranza.",
    screenshot: "credit-plans.png",
    icon: CreditCard,
    color: colors.amber,
    focus: [
      { x: 292, y: 233, w: 1284, h: 116, label: "Deuda y vencidos", delay: 18 },
      { x: 292, y: 414, w: 1284, h: 346, label: "Planes expandibles", delay: 92 },
    ],
  },
  {
    id: "map",
    title: "Mapa de deudores",
    subtitle: "Ubicacion y seguimiento en campo.",
    screenshot: "map.png",
    icon: MapPinned,
    color: colors.emerald,
    focus: [
      { x: 325, y: 180, w: 1170, h: 650, label: "Ubicacion de deudores", delay: 20 },
      { x: 1510, y: 184, w: 330, h: 520, label: "Prioridad de visita", delay: 92 },
    ],
  },
  {
    id: "reports",
    title: "Reportes",
    subtitle: "Ventas, inventario, clientes, cobranzas y exportaciones.",
    screenshot: "reports.png",
    icon: FileSpreadsheet,
    color: colors.violet,
    focus: [
      { x: 1315, y: 254, w: 565, h: 36, label: "Categorias", delay: 22 },
      { x: 329, y: 306, w: 1550, h: 592, label: "Reportes por area", delay: 122 },
    ],
  },
  {
    id: "admin",
    title: "Administracion",
    subtitle: "Usuarios, permisos, configuracion, logo y logs.",
    screenshot: "admin-users.png",
    icon: ShieldCheck,
    color: colors.primary,
    focus: [
      { x: 312, y: 190, w: 1080, h: 150, label: "Usuarios y roles", delay: 18 },
      { x: 312, y: 390, w: 1470, h: 430, label: "Permisos operativos", delay: 106 },
    ],
  },
];

const textStyle: CSSProperties = {
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: colors.text,
};

const ease = Easing.bezier(0.16, 1, 0.3, 1);

const interp = (frame: number, input: [number, number], output: [number, number]) =>
  interpolate(frame, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });

const timingFor = (id: string) => {
  const timing = voiceTimeline.find((entry) => entry.id === id);
  if (!timing) {
    throw new Error(`Missing timeline entry for ${id}`);
  }
  return timing;
};

const visualEntries = voiceTimeline.filter((entry) => entry.id !== "intro" && entry.id !== "ending");

const Pill = ({ children, color }: { children: ReactNode; color: string }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      borderRadius: 999,
      padding: "9px 13px",
      background: `${color}22`,
      border: `1px solid ${color}55`,
      color,
      fontSize: 15,
      fontWeight: 850,
    }}
  >
    {children}
  </div>
);

const AmbientFocus = ({
  target,
  color,
  durationFrames,
  index,
}: {
  target: Scene["focus"][number];
  color: string;
  durationFrames: number;
  index: number;
}) => {
  const frame = useCurrentFrame();
  const delay = target.delay ?? 24;
  const out = Math.min(durationFrames - 26, delay + 120);
  const visible = Math.min(interp(frame, [delay, delay + 22], [0, 1]), interp(frame, [out, out + 24], [1, 0]));
  const pulse = Math.sin(Math.max(0, frame - delay) / 12) * 0.5 + 0.5;
  const centerX = target.x + target.w * 0.52;
  const centerY = target.y + target.h * 0.5;
  const glowW = Math.min(1500, Math.max(620, target.w * 0.88 + 300));
  const glowH = Math.min(860, Math.max(320, target.h * 0.9 + 240));
  const drift = interp(frame, [delay, out], [-18, 18]) * (index % 2 === 0 ? 1 : -1);
  const lineX = interp(frame, [delay + 8, out - 10], [-0.25, 1.25]);

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: centerX - glowW / 2 + drift,
          top: centerY - glowH / 2 - drift * 0.35,
          width: glowW,
          height: glowH,
          opacity: visible * (0.38 + pulse * 0.16),
          borderRadius: 42,
          background: `radial-gradient(ellipse at center, ${color}40 0%, ${color}1f 34%, transparent 72%)`,
          filter: "blur(8px)",
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: target.x + Math.max(22, target.w * 0.04),
          top: centerY,
          width: Math.max(190, target.w * 0.88),
          height: 3,
          opacity: visible * 0.7,
          overflow: "hidden",
          borderRadius: 999,
          background: `linear-gradient(90deg, transparent, ${color}22, transparent)`,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `${lineX * 100}%`,
            top: 0,
            width: 180,
            height: 3,
            borderRadius: 999,
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
            boxShadow: `0 0 18px ${color}`,
            transform: "translateX(-50%)",
          }}
        />
      </div>
    </>
  );
};

const Sweep = ({ color, durationFrames }: { color: string; durationFrames: number }) => {
  const frame = useCurrentFrame();
  const x = interp(frame, [0, Math.min(56, durationFrames * 0.32)], [-360, 2120]);
  const opacity = Math.min(interp(frame, [6, 24], [0, 0.42]), interp(frame, [48, 72], [0.42, 0]));

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: x,
        width: 150,
        opacity,
        background: `linear-gradient(90deg, transparent, ${color}33, transparent)`,
        transform: "skewX(-12deg)",
        pointerEvents: "none",
      }}
    />
  );
};

const ScreenshotScene = ({ scene, durationFrames }: { scene: Scene; durationFrames: number }) => {
  const frame = useCurrentFrame();
  const fadeIn = interp(frame, [0, 18], [0, 1]);
  const fadeOut = interp(frame, [durationFrames - 18, durationFrames], [1, 0]);
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ background: colors.bg, opacity, ...textStyle }}>
      <Img
        src={staticFile(`videos/screenshots/${scene.screenshot}`)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "saturate(1.04) contrast(1.02)",
        }}
      />
      <Sweep color={scene.color} durationFrames={durationFrames} />
      {scene.focus.map((target, index) => (
        <AmbientFocus
          key={`${scene.id}-${target.label}`}
          target={target}
          color={scene.color}
          durationFrames={durationFrames}
          index={index}
        />
      ))}
    </AbsoluteFill>
  );
};

const Intro = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: colors.bg, ...textStyle }}>
      <Img
        src={staticFile("videos/screenshots/dashboard.png")}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(1px) saturate(1.04)",
          opacity: 0.54,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(90deg, rgba(2,6,23,0.96), rgba(2,6,23,0.76), rgba(2,6,23,0.38))",
        }}
      />
      <div style={{ position: "absolute", left: 340, top: 168, maxWidth: 900 }}>
        <div
          style={{
            opacity: interp(frame, [10, 34], [0, 1]),
            transform: `translateY(${interp(frame, [10, 34], [30, 0])}px)`,
          }}
        >
          <Pill color={colors.emerald}>
            <Sparkles size={18} />
            Demo real de producto
          </Pill>
          <h1
            style={{
              margin: "28px 0 0",
              fontSize: 84,
              lineHeight: 0.94,
              letterSpacing: 0,
              fontWeight: 950,
              textShadow: "0 20px 70px rgba(0,0,0,0.72)",
            }}
          >
            Adiction Boutique Suite
          </h1>
          <p style={{ margin: "28px 0 0", color: colors.muted, fontSize: 29, lineHeight: 1.34 }}>
            Un recorrido por el ERP en produccion: ventas, caja, inventario, cobranzas, devoluciones y reportes.
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Ending = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: colors.bg, ...textStyle }}>
      <Img
        src={staticFile("videos/screenshots/reports.png")}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.42,
          filter: "saturate(1.04)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: "rgba(2,6,23,0.84)" }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          padding: 80,
        }}
      >
        <div
          style={{
            opacity: interp(frame, [12, 42], [0, 1]),
            transform: `translateY(${interp(frame, [12, 42], [30, 0])}px)`,
          }}
        >
          <Store size={58} color={colors.emerald} />
          <h1 style={{ margin: "26px 0 0", fontSize: 72, lineHeight: 1, letterSpacing: 0, fontWeight: 950 }}>
            Operar con informacion clara
          </h1>
          <p style={{ margin: "24px auto 0", maxWidth: 920, color: colors.muted, fontSize: 27, lineHeight: 1.36 }}>
            Adiction Boutique Suite conecta cada venta, cobro, movimiento, devolucion y reporte en una sola plataforma.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 34 }}>
            <Pill color={colors.primary}>Vender</Pill>
            <Pill color={colors.emerald}>Controlar</Pill>
            <Pill color={colors.amber}>Cobrar</Pill>
            <Pill color={colors.violet}>Auditar</Pill>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Sfx = () => {
  return (
    <>
      <Audio src={staticFile("videos/sfx/bg-bed.wav")} volume={0.055} />
      {visualEntries.slice(1).map((entry) => (
        <Sequence key={`whoosh-${entry.id}`} from={entry.startFrame} durationInFrames={30} layout="none">
          <Audio src={staticFile("videos/sfx/whoosh.wav")} volume={0.09} />
        </Sequence>
      ))}
    </>
  );
};

const Voiceover = () => (
  <>
    {voiceTimeline.map((entry) => (
      <Sequence key={`voice-${entry.id}`} from={entry.audioStartFrame} durationInFrames={entry.audioDurationFrames} layout="none">
        <Audio src={staticFile(entry.audioPath)} volume={1} />
      </Sequence>
    ))}
  </>
);

const AvatarOverlay = ({ src }: { src: string }) => {
  const frame = useCurrentFrame();
  const opacity = interp(frame, [18, 48], [0, 1]);

  return (
    <div
      style={{
        position: "absolute",
        right: 48,
        bottom: 76,
        width: 320,
        height: 320,
        borderRadius: 18,
        overflow: "hidden",
        background: colors.panel,
        border: `1px solid ${colors.border}`,
        boxShadow: "0 26px 80px rgba(0,0,0,0.45)",
        opacity,
      }}
    >
      <OffthreadVideo
        src={staticFile(src)}
        volume={0}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </div>
  );
};

export const PromoVideo = ({ avatarVideoPath, showAvatar = false }: PromoVideoProps) => {
  const intro = timingFor("intro");
  const ending = timingFor("ending");

  return (
    <AbsoluteFill style={{ background: colors.bg, ...textStyle }}>
      <Sfx />
      <Voiceover />
      <Sequence from={intro.startFrame} durationInFrames={intro.durationFrames}>
        <Intro />
      </Sequence>
      {scenes.map((scene) => {
        const timing = timingFor(scene.id);
        return (
          <Sequence key={scene.id} from={timing.startFrame} durationInFrames={timing.durationFrames}>
            <ScreenshotScene scene={scene} durationFrames={timing.durationFrames} />
          </Sequence>
        );
      })}
      <Sequence from={ending.startFrame} durationInFrames={ending.durationFrames}>
        <Ending />
      </Sequence>
      {showAvatar && avatarVideoPath ? <AvatarOverlay src={avatarVideoPath} /> : null}
    </AbsoluteFill>
  );
};
