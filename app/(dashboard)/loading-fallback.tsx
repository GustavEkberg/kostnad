export function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="relative">
        <span className="animate-pulse text-9xl font-bold">K</span>
        {/* Fly buzzing erratically around the K */}
        <span className="absolute text-lg animate-[fly_3s_linear_infinite]">🪰</span>
      </div>
      <style>{`
        @keyframes fly {
          0% { top: -40px; left: 50%; transform: rotate(0deg) scale(0.6) rotateY(0deg); }
          4% { top: 20%; left: 80%; transform: rotate(120deg) scale(1.1) rotateY(180deg); }
          8% { top: 45%; left: 50%; transform: rotate(45deg) scale(1.4) rotateX(45deg); }
          12% { top: 30%; left: 120%; transform: rotate(-90deg) scale(0.5) rotateY(0deg); }
          16% { top: 80%; left: 90%; transform: rotate(200deg) scale(1.2) rotateX(-30deg); }
          20% { top: 110%; left: 40%; transform: rotate(-45deg) scale(0.7) rotateY(180deg); }
          24% { top: 50%; left: 45%; transform: rotate(90deg) scale(1.5) rotateX(60deg); }
          28% { top: 70%; left: -30%; transform: rotate(270deg) scale(0.4) rotateY(0deg); }
          32% { top: 20%; left: 10%; transform: rotate(-120deg) scale(1.3) rotateX(-45deg); }
          36% { top: -30px; left: -20%; transform: rotate(180deg) scale(0.5) rotateY(180deg); }
          40% { top: 40%; left: 55%; transform: rotate(-200deg) scale(1.6) rotateX(30deg); }
          44% { top: 60%; left: 100%; transform: rotate(60deg) scale(0.8) rotateY(0deg); }
          48% { top: 35%; left: 50%; transform: rotate(-30deg) scale(1.3) rotateX(-60deg); }
          52% { top: 90%; left: 30%; transform: rotate(150deg) scale(0.6) rotateY(180deg); }
          56% { top: 55%; left: -10%; transform: rotate(-150deg) scale(1.1) rotateX(45deg); }
          60% { top: 25%; left: 40%; transform: rotate(240deg) scale(1.4) rotateY(0deg); }
          64% { top: -20px; left: 80%; transform: rotate(-60deg) scale(0.5) rotateX(-30deg); }
          68% { top: 50%; left: 60%; transform: rotate(30deg) scale(1.2) rotateY(180deg); }
          72% { top: 100%; left: 20%; transform: rotate(-240deg) scale(0.7) rotateX(60deg); }
          76% { top: 40%; left: 50%; transform: rotate(100deg) scale(1.5) rotateY(0deg); }
          80% { top: 15%; left: -15%; transform: rotate(-100deg) scale(0.4) rotateX(-45deg); }
          84% { top: 65%; left: 70%; transform: rotate(220deg) scale(1.1) rotateY(180deg); }
          88% { top: 45%; left: 110%; transform: rotate(-180deg) scale(0.6) rotateX(30deg); }
          92% { top: 10%; left: 60%; transform: rotate(80deg) scale(1.3) rotateY(0deg); }
          96% { top: -10px; left: 30%; transform: rotate(-70deg) scale(0.8) rotateX(-60deg); }
          100% { top: -40px; left: 50%; transform: rotate(0deg) scale(0.6) rotateY(0deg); }
        }
      `}</style>
    </div>
  );
}
