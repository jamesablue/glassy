import { identifyUrl, parsePixelValue } from './identify';

describe('identifyUrl', () => {
  it('asks for the pixel at a WGS 84 point without extras', () => {
    const url = identifyUrl('https://example.com/ImageServer', { lat: 21.269, lon: -157.6936 });
    expect(url).toBe(
      'https://example.com/ImageServer/identify?geometry=' +
        '%7B%22x%22%3A-157.6936%2C%22y%22%3A21.269%2C%22spatialReference%22%3A%7B%22wkid%22%3A4326%7D%7D' +
        '&geometryType=esriGeometryPoint&returnGeometry=false&returnCatalogItems=false&f=json',
    );
    expect(JSON.parse(new URL(url).searchParams.get('geometry') ?? '')).toEqual({
      x: -157.6936,
      y: 21.269,
      spatialReference: { wkid: 4326 },
    });
  });
});

describe('parsePixelValue', () => {
  it.each([
    ['-8.50096', -8.50096],
    ['63.305', 63.305],
    [' -5099 ', -5099],
    ['0', 0],
  ])('reads %j as %s', (value, expected) => {
    expect(parsePixelValue(value)).toBe(expected);
  });

  it.each(['NoData', '', '  ', '12 m', 'Infinity', 'NaN'])('reads %j as NaN', (value) => {
    expect(parsePixelValue(value)).toBeNaN();
  });
});
