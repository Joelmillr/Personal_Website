import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import lottie from 'lottie-web';

const StyledLoader = styled.div`
  background-color: transparent;
  overflow: hidden;
  text-align: center;
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 99;

  #animationWindow {
    width: 100%;
    height: 100%;
  }
`;

const Loader = ({ finishLoading }) => {
  useEffect(() => {
    const animData = {
      container: document.querySelector('#animationWindow'),
      renderer: 'svg',
      loop: false, // Set loop to false for better control
      autoplay: true,
      path: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/35984/LEGO_loader_chrisgannon.json',
    };
    const anim = lottie.loadAnimation(animData);
    anim.setSpeed(3.24);

    // Manually stop the loader after a set time (e.g., 5 seconds)
    const timeout = setTimeout(() => {
      finishLoading();
    }, 2000); // Adjust this duration as needed

    return () => {
      anim.destroy(); // Clean up the animation when the component is unmounted
      clearTimeout(timeout);
    };
  }, [finishLoading]);

  return (
    <StyledLoader className="loader">
      <div id="animationWindow"></div>
    </StyledLoader>
  );
};

Loader.propTypes = {
  finishLoading: PropTypes.func.isRequired,
};

export default Loader;
