import React from 'react';
import QurixLogoSvg from '../../assets/qurix_logo.svg';

// Thin wrapper around the Qurix SVG logo so call sites don't need to know
// the asset path or worry about SVG-as-component setup.
// Pass `width` / `height` (defaults to 32) and any standard SVG props.
const BrandLogo = ({ width = 32, height = 32, ...props }) => (
  <QurixLogoSvg width={width} height={height} {...props} />
);

export default BrandLogo;
