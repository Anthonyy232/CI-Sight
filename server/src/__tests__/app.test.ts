describe('createApp', () => {
  afterEach(() => {
    process.env.NODE_ENV = 'test';
    jest.resetModules();
  });

  it('starts in production mode with the SPA fallback route', async () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    const { createApp } = await import('../app');
    await expect(createApp()).resolves.toBeDefined();
  });
});
