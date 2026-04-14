'use client';

export function WebinarIllustration() {
  return (
    <div className="relative w-full max-w-md mx-auto">
      <style>{`
        svg#freepik_stories-webinar:not(.animated) .animable {opacity: 0;}
        svg#freepik_stories-webinar.animated #freepik--Floor--inject-16 {animation: 1s 1 forwards cubic-bezier(.36,-0.01,.5,1.38) zoomOut;animation-delay: 0s;}
        svg#freepik_stories-webinar.animated #freepik--Shadows--inject-16 {animation: 1s 1 forwards cubic-bezier(.36,-0.01,.5,1.38) slideDown;animation-delay: 0s;}
        svg#freepik_stories-webinar.animated #freepik--Books--inject-16 {animation: 1s 1 forwards cubic-bezier(.36,-0.01,.5,1.38) slideRight;animation-delay: 0s;}
        svg#freepik_stories-webinar.animated #freepik--graduation-cap--inject-16 {animation: 1s 1 forwards cubic-bezier(.36,-0.01,.5,1.38) slideDown;animation-delay: 0s;}
        svg#freepik_stories-webinar.animated #freepik--Apple--inject-16 {animation: 1s 1 forwards cubic-bezier(.36,-0.01,.5,1.38) slideUp;animation-delay: 0s;}
        svg#freepik_stories-webinar.animated #freepik--Pen--inject-16 {animation: 1s 1 forwards cubic-bezier(.36,-0.01,.5,1.38) lightSpeedLeft;animation-delay: 0s;}
        svg#freepik_stories-webinar.animated #freepik--Pencil--inject-16 {animation: 1s 1 forwards cubic-bezier(.36,-0.01,.5,1.38) zoomOut;animation-delay: 0s;}
        svg#freepik_stories-webinar.animated #freepik--speech-bubble--inject-16 {animation: 1s 1 forwards cubic-bezier(.36,-0.01,.5,1.38) lightSpeedLeft;animation-delay: 0s;}
        svg#freepik_stories-webinar.animated #freepik--Character--inject-16 {animation: 1s 1 forwards cubic-bezier(.36,-0.01,.5,1.38) zoomIn;animation-delay: 0s;}
        @keyframes zoomOut { 0% { opacity: 0; transform: scale(1.5); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes slideDown { 0% { opacity: 0; transform: translateY(-30px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes slideRight { 0% { opacity: 0; transform: translateX(30px); } 100% { opacity: 1; transform: translateX(0); } }
        @keyframes slideUp { 0% { opacity: 0; transform: translateY(30px); } 100% { opacity: 1; transform: inherit; } }
        @keyframes lightSpeedLeft { from { transform: translate3d(-50%, 0, 0) skewX(20deg); opacity: 0; } 60% { transform: skewX(-10deg); opacity: 1; } 80% { transform: skewX(2deg); } to { opacity: 1; transform: translate3d(0, 0, 0); } }
        @keyframes zoomIn { 0% { opacity: 0; transform: scale(0.5); } 100% { opacity: 1; transform: scale(1); } }
      `}</style>
      <svg 
        className="animated" 
        id="freepik_stories-webinar" 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 500 500"
        style={{ width: '100%', height: 'auto', maxHeight: '400px' }}
      >
        {/* SVG content would go here - it's very long so I'm showing the structure */}
        <g id="freepik--Floor--inject-16" className="animable" style={{ transformOrigin: '250px 346.97px' }}>
          <ellipse cx="250" cy="346.97" rx="238.01" ry="141.59" style={{ fill: 'rgb(245, 245, 245)', transformOrigin: '250px 346.97px' }} />
        </g>
        {/* Add remaining SVG groups here */}
      </svg>
    </div>
  );
}
