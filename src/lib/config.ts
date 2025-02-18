const createConfig = () => {
  const viewWidth = 64;
  const viewTiles = viewWidth ** 2
  const mapWidth = 4;
  const views = mapWidth ** 2
  const totalTiles = viewTiles * views
  
  return {
    viewWidth,
    viewTiles,
    views,
    mapWidth,
    totalTiles,
  };
};

const config = createConfig();

export default config