/**
 * Animated SVG avatar for login form.
 * - Eyes follow the caret position when typing in the email field.
 * - Both arms rise to cover the eyes when the password field is focused.
 *
 * Uses CSS transitions on CSS `transform` property (with px units that map
 * 1:1 to SVG user units inside a viewBox). The arms are clipped by a circular
 * clipPath so they're invisible at their "down" position (y=220).
 */
import { forwardRef } from 'react';

const EYE_MAX_H = 20;
const EYE_MAX_V = 10;

let _canvas: HTMLCanvasElement | null = null;
function measureTextWidth(text: string, font: string): number {
  if (!_canvas) _canvas = document.createElement('canvas');
  const ctx = _canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = font;
  return ctx.measureText(text).width;
}

function getAngle(x1: number, y1: number, x2: number, y2: number) {
  return Math.atan2(y1 - y2, x1 - x2);
}

export interface GazeState {
  eyeLX: number;
  eyeLY: number;
  eyeRX: number;
  eyeRY: number;
}

export function computeGaze(
  emailInput: HTMLInputElement | null,
  avatarContainer: HTMLElement | null,
): GazeState | null {
  if (!emailInput || !avatarContainer) return null;

  const inputRect = emailInput.getBoundingClientRect();
  const avatarRect = avatarContainer.getBoundingClientRect();
  const style = getComputedStyle(emailInput);
  const padL = parseFloat(style.paddingLeft) || 0;
  const padR = parseFloat(style.paddingRight) || 0;
  const font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

  const caretIdx = emailInput.selectionEnd ?? emailInput.value.length;
  const textW = measureTextWidth(emailInput.value.substring(0, caretIdx), font);
  const visibleW = inputRect.width - padL - padR;
  const clamped = Math.min(Math.max(textW - emailInput.scrollLeft, 0), visibleW);

  const caretX = inputRect.left + padL + clamped;
  const caretY = inputRect.top + inputRect.height / 2;

  const scale = avatarRect.width / 200;
  const eyeLX = avatarRect.left + 85.5 * scale;
  const eyeLY = avatarRect.top + 78.5 * scale;
  const eyeRX = avatarRect.left + 114.5 * scale;
  const eyeRY = avatarRect.top + 78.5 * scale;

  const aL = getAngle(eyeLX, eyeLY, caretX, caretY);
  const aR = getAngle(eyeRX, eyeRY, caretX, caretY);

  return {
    eyeLX: -Math.cos(aL) * EYE_MAX_H,
    eyeLY: -Math.sin(aL) * EYE_MAX_V,
    eyeRX: -Math.cos(aR) * EYE_MAX_H,
    eyeRY: -Math.sin(aR) * EYE_MAX_V,
  };
}

export interface LoginAvatarProps {
  gaze: GazeState | null;
  eyesCovered: boolean;
  emailFocused: boolean;
}

const LoginAvatar = forwardRef<HTMLDivElement, LoginAvatarProps>(function LoginAvatar(
  { gaze, eyesCovered, emailFocused },
  ref,
) {
  const g = gaze && emailFocused ? gaze : { eyeLX: 0, eyeLY: 0, eyeRX: 0, eyeRY: 0 };

  const eyeLTransform = `translate(${g.eyeLX}px, ${g.eyeLY}px)`;
  const eyeRTransform = `translate(${g.eyeRX}px, ${g.eyeRY}px)`;

  const armLTransform = eyesCovered
    ? 'translate(-93px, 10px) rotate(0deg)'
    : 'translate(-93px, 220px) rotate(105deg)';
  const armRTransform = eyesCovered
    ? 'translate(-93px, 10px) rotate(0deg)'
    : 'translate(-93px, 220px) rotate(-105deg)';

  return (
    <div ref={ref} className="auth-avatar-wrap">
      <div className="auth-avatar-svg-container">
        <svg
          className="auth-avatar-svg"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 200 200"
          aria-hidden
        >
          <defs>
            <circle id="avatar-armMaskPath" cx="100" cy="100" r="100" />
          </defs>
          <clipPath id="avatar-armMask">
            <use href="#avatar-armMaskPath" overflow="visible" />
          </clipPath>

          {/* Background */}
          <circle className="avatar-bg" cx="100" cy="100" r="100" />

          {/* Body */}
          <g className="avatar-body">
            <path className="avatar-bodyBG" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              d="M200,158.5c0-20.2-14.8-36.5-35-36.5h-14.9V72.8c0-27.4-21.7-50.4-49.1-50.8c-28-0.5-50.9,22.1-50.9,50v50 H35.8C16,122,0,138,0,157.8L0,213h200L200,158.5z" />
            <path className="avatar-bodyFill"
              d="M100,156.4c-22.9,0-43,11.1-54.1,27.7c15.6,10,34.2,15.9,54.1,15.9s38.5-5.8,54.1-15.9 C143,167.5,122.9,156.4,100,156.4z" />
          </g>

          {/* Left ear */}
          <g className="avatar-earL">
            <g className="avatar-outerEar" strokeWidth="2.5">
              <circle cx="47" cy="83" r="11.5" />
              <path d="M46.3 78.9c-2.3 0-4.1 1.9-4.1 4.1 0 2.3 1.9 4.1 4.1 4.1" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <g className="avatar-earHair">
              <rect className="avatar-hair" x="51" y="64" width="15" height="35" />
              <path className="avatar-hair" d="M53.4 62.8C48.5 67.4 45 72.2 42.8 77c3.4-.1 6.8-.1 10.1.1-4 3.7-6.8 7.6-8.2 11.6 2.1 0 4.2 0 6.3.2-2.6 4.1-3.8 8.3-3.7 12.5 1.2-.7 3.4-1.4 5.2-1.9"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>

          {/* Right ear */}
          <g className="avatar-earR">
            <g className="avatar-outerEar">
              <circle className="avatar-skin" strokeWidth="2.5" cx="153" cy="83" r="11.5" />
              <path className="avatar-skin" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                d="M153.7,78.9 c2.3,0,4.1,1.9,4.1,4.1c0,2.3-1.9,4.1-4.1,4.1" />
            </g>
            <g className="avatar-earHair">
              <rect className="avatar-hair" x="134" y="64" width="15" height="35" />
              <path className="avatar-hair" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                d="M146.6,62.8 c4.9,4.6,8.4,9.4,10.6,14.2c-3.4-0.1-6.8-0.1-10.1,0.1c4,3.7,6.8,7.6,8.2,11.6c-2.1,0-4.2,0-6.3,0.2c2.6,4.1,3.8,8.3,3.7,12.5 c-1.2-0.7-3.4-1.4-5.2-1.9" />
            </g>
          </g>

          {/* Chin */}
          <path className="avatar-chin avatar-outline" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            d="M84.1 121.6c2.7 2.9 6.1 5.4 9.8 7.5l.9-4.5c2.9 2.5 6.3 4.8 10.2 6.5 0-1.9-.1-3.9-.2-5.8 3 1.2 6.2 2 9.7 2.5-.3-2.1-.7-4.1-1.2-6.1" />

          {/* Face */}
          <path className="avatar-face avatar-skin"
            d="M134.5,46v35.5c0,21.815-15.446,39.5-34.5,39.5s-34.5-17.685-34.5-39.5V46" />

          {/* Hair */}
          <path className="avatar-hair" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            d="M81.457,27.929 c1.755-4.084,5.51-8.262,11.253-11.77c0.979,2.565,1.883,5.14,2.712,7.723c3.162-4.265,8.626-8.27,16.272-11.235 c-0.737,3.293-1.588,6.573-2.554,9.837c4.857-2.116,11.049-3.64,18.428-4.156c-2.403,3.23-5.021,6.391-7.852,9.474" />

          {/* Eyebrows */}
          <g className="avatar-eyebrow">
            <path className="avatar-hair"
              d="M138.142,55.064c-4.93,1.259-9.874,2.118-14.787,2.599c-0.336,3.341-0.776,6.689-1.322,10.037 c-4.569-1.465-8.909-3.222-12.996-5.226c-0.98,3.075-2.07,6.137-3.267,9.179c-5.514-3.067-10.559-6.545-15.097-10.329 c-1.806,2.889-3.745,5.73-5.816,8.515c-7.916-4.124-15.053-9.114-21.296-14.738l1.107-11.768h73.475V55.064z" />
            <path className="avatar-hair avatar-outline" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              d="M63.56,55.102 c6.243,5.624,13.38,10.614,21.296,14.738c2.071-2.785,4.01-5.626,5.816-8.515c4.537,3.785,9.583,7.263,15.097,10.329 c1.197-3.043,2.287-6.104,3.267-9.179c4.087,2.004,8.427,3.761,12.996,5.226c0.545-3.348,0.986-6.696,1.322-10.037 c4.913-0.481,9.857-1.34,14.787-2.599" />
          </g>

          {/* Left eye */}
          <g className="avatar-eyeL" style={{ transform: eyeLTransform, transformOrigin: '85.5px 78.5px' }}>
            <circle className="avatar-iris" cx="85.5" cy="78.5" r="3.5" />
            <circle className="avatar-eyeHighlight" cx="84" cy="76" r="1" />
          </g>

          {/* Right eye */}
          <g className="avatar-eyeR" style={{ transform: eyeRTransform, transformOrigin: '114.5px 78.5px' }}>
            <circle className="avatar-iris" cx="114.5" cy="78.5" r="3.5" />
            <circle className="avatar-eyeHighlight" cx="113" cy="76" r="1" />
          </g>

          {/* Mouth */}
          <g className="avatar-mouth">
            <path className="avatar-mouthBG avatar-mouthFill"
              d="M100.2,101c-0.4,0-1.4,0-1.8,0c-2.7-0.3-5.3-1.1-8-2.5c-0.7-0.3-0.9-1.2-0.6-1.8 c0.2-0.5,0.7-0.7,1.2-0.7c0.2,0,0.5,0.1,0.6,0.2c3,1.5,5.8,2.3,8.6,2.3s5.7-0.7,8.6-2.3c0.2-0.1,0.4-0.2,0.6-0.2 c0.5,0,1,0.3,1.2,0.7c0.4,0.7,0.1,1.5-0.6,1.9c-2.6,1.4-5.3,2.2-7.9,2.5C101.7,101,100.5,101,100.2,101z" />
            <path className="avatar-outline" fill="none" strokeWidth="2.5" strokeLinejoin="round"
              d="M100.2,101c-0.4,0-1.4,0-1.8,0c-2.7-0.3-5.3-1.1-8-2.5c-0.7-0.3-0.9-1.2-0.6-1.8 c0.2-0.5,0.7-0.7,1.2-0.7c0.2,0,0.5,0.1,0.6,0.2c3,1.5,5.8,2.3,8.6,2.3s5.7-0.7,8.6-2.3c0.2-0.1,0.4-0.2,0.6-0.2 c0.5,0,1,0.3,1.2,0.7c0.4,0.7,0.1,1.5-0.6,1.9c-2.6,1.4-5.3,2.2-7.9,2.5C101.7,101,100.5,101,100.2,101z" />
          </g>

          {/* Nose */}
          <path className="avatar-nose avatar-iris avatar-outline" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            d="M97.7 79.9h4.7c1.9 0 3 2.2 1.9 3.7l-2.3 3.3c-.9 1.3-2.9 1.3-3.8 0l-2.3-3.3c-1.3-1.6-.2-3.7 1.8-3.7z" />

          {/* Arms (clipped by circular mask) */}
          <g className="avatar-arms" clipPath="url(#avatar-armMask)">
            {/* Left arm (drawn on right side of SVG, mirrored via translate) */}
            <g className="avatar-armL" style={{ transformOrigin: '0% 0%', transform: armLTransform }}>
              <polygon strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10}
                points="121.3,98.4 111,59.7 149.8,49.3 169.8,85.4" />
              <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10}
                d="M134.4,53.5l19.3-5.2c2.7-0.7,5.4,0.9,6.1,3.5v0c0.7,2.7-0.9,5.4-3.5,6.1l-10.3,2.8" />
              <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10}
                d="M150.9,59.4l26-7c2.7-0.7,5.4,0.9,6.1,3.5v0c0.7,2.7-0.9,5.4-3.5,6.1l-21.3,5.7" />
              <path fill="#DDF1FA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10}
                d="M123.5,97.8 c-41.4,14.9-84.1,30.7-108.2,35.5L1.2,81c33.5-9.9,71.9-16.5,111.9-21.8" />
              <path className="avatar-armSleeve" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                d="M108.5,60.4 c7.7-5.3,14.3-8.4,22.8-13.2c-2.4,5.3-4.7,10.3-6.7,15.1c4.3,0.3,8.4,0.7,12.3,1.3c-4.2,5-8.1,9.6-11.5,13.9 c3.1,1.1,6,2.4,8.7,3.8c-1.4,2.9-2.7,5.8-3.9,8.5c2.5,3.5,4.6,7.2,6.3,11c-4.9-0.8-9-0.7-16.2-2.7" />
              <path className="avatar-armSleeve" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                d="M94.5,103.8 c-0.6,4-3.8,8.9-9.4,14.7c-2.6-1.8-5-3.7-7.2-5.7c-2.5,4.1-6.6,8.8-12.2,14c-1.9-2.2-3.4-4.5-4.5-6.9c-4.4,3.3-9.5,6.9-15.4,10.8 c-0.2-3.4,0.1-7.1,1.1-10.9" />
              <path className="avatar-armSleeve" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                d="M97.5,63.9 c-1.7-2.4-5.9-4.1-12.4-5.2c-0.9,2.2-1.8,4.3-2.5,6.5c-3.8-1.8-9.4-3.1-17-3.8c0.5,2.3,1.2,4.5,1.9,6.8c-5-0.6-11.2-0.9-18.4-1 c2,2.9,0.9,3.5,3.9,6.2" />
            </g>

            {/* Right arm (drawn on far right, mirrored via translate) */}
            <g className="avatar-armR" style={{ transformOrigin: '100% 0%', transform: armRTransform }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} strokeWidth="2.5"
                d="M265.4 97.3l10.4-38.6-38.9-10.5-20 36.1z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} strokeWidth="2.5"
                d="M252.4 52.4L233 47.2c-2.7-.7-5.4.9-6.1 3.5-.7 2.7.9 5.4 3.5 6.1l10.3 2.8M226 76.4l-19.4-5.2c-2.7-.7-5.4.9-6.1 3.5-.7 2.7.9 5.4 3.5 6.1l18.3 4.9M228.4 66.7l-23.1-6.2c-2.7-.7-5.4.9-6.1 3.5-.7 2.7.9 5.4 3.5 6.1l23.1 6.2M235.8 58.3l-26-7c-2.7-.7-5.4.9-6.1 3.5-.7 2.7.9 5.4 3.5 6.1l21.3 5.7" />
              <path className="avatar-armAccent"
                d="M207.9 74.7l-2.2-.6c-1.1-.3-2.2.3-2.4 1.4-.3 1.1.3 2.2 1.4 2.4l2.2.6 1-3.8zM206.7 64l-2.2-.6c-1.1-.3-2.2.3-2.4 1.4-.3 1.1.3 2.2 1.4 2.4l2.2.6 1-3.8zM211.2 54.8l-2.2-.6c-1.1-.3-2.2.3-2.4 1.4-.3 1.1.3 2.2 1.4 2.4l2.2.6 1-3.8zM234.6 49.4l-2.2-.6c-1.1-.3-2.2.3-2.4 1.4-.3 1.1.3 2.2 1.4 2.4l2.2.6 1-3.8z" />
              <path className="avatar-armSleeve" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                d="M263.3 96.7c41.4 14.9 84.1 30.7 108.2 35.5l14-52.3C352 70 313.6 63.5 273.6 58.1" />
              <path className="avatar-armSleeve" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                d="M278.2 59.3l-18.6-10 2.5 11.9-10.7 6.5 9.9 8.7-13.9 6.4 9.1 5.9-13.2 9.2 23.1-.9M284.5 100.1c-.4 4 1.8 8.9 6.7 14.8 3.5-1.8 6.7-3.6 9.7-5.5 1.8 4.2 5.1 8.9 10.1 14.1 2.7-2.1 5.1-4.4 7.1-6.8 4.1 3.4 9 7 14.7 11 1.2-3.4 1.8-7 1.7-10.9M314 66.7s5.4-5.7 12.6-7.4c1.7 2.9 3.3 5.7 4.9 8.6 3.8-2.5 9.8-4.4 18.2-5.7.1 3.1.1 6.1 0 9.2 5.5-1 12.5-1.6 20.8-1.9-1.4 3.9-2.5 8.4-2.5 8.4" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
});

export default LoginAvatar;
