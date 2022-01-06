import { expect } from 'chai';
import { Client, BaseState, Links, HalState } from '../../src';

describe('Client', () => {

  describe('Resource caching', () => {

    it('should invalidate a resource\'s cache if an unsafe method was used', async () => {

      const client = new Client('https://example.org');
      client.cache.store(new BaseState({
        client,
        uri: 'https://example.org/foo',
        data: 'hello',
        headers: new Headers(),
        links: new Links('http://example.org/foo'),
      }));

      client.use( async req => {
        return new Response('OK');
      });
      const request = new Request('https://example.org/foo', {
        method: 'POST'
      });

      await client.fetcher.fetch(request);
      expect(client.cache.has('https://example.org/foo')).to.equal(false);

    });

    it('should not invalidate a resource\'s cache if a safe method was used', () => {

      const client = new Client('https://example.org');
      client.cache.store(new BaseState({
        client,
        uri: 'https://example.org/foo',
        data: 'hello',
        headers: new Headers(),
        links: new Links('http://example.org/foo'),
      }));

      const request = new Request('https://example.org/foo', {
        method: 'SEARCH'
      });

      client.use( async req => {
        return new Response('OK');
      });

      client.fetcher.fetch(request);
      expect(client.cache.has('https://example.org/foo')).to.equal(true);

    });

    it('should invalidate resources if they were mentioned in a Link header with rel="invalidates"', async () => {

      const client = new Client('https://example.org');
      client.cache.store(new BaseState({
        client,
        uri: 'https://example.org/foo',
        data: 'hello',
        headers: new Headers(),
        links: new Links('http://example.org/foo'),
      }));

      const request = new Request('https://example.org/foo', {
        method: 'DELETE',
      });

      const headers = new Headers();
      headers.append('Link', '</bar>; rel="invalidates"');
      headers.append('Link', '</zim>; rel="invalidates"');
      client.use( async req => {
        return new Response('OK', { headers });
      });

      await client.fetcher.fetch(request);
      expect(client.cache.has('https://example.org/foo')).to.equal(false);

    });

    it('should cache embedded resources', async() => {

      const client = new Client('https://example.org');
      const body = {
        _embedded: {
          rel: {
            _links: {
              self: { href: '/embedded'},
            },
            item: 1
          }
        },
        item: 2,
      };
      const response = new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/hal+json'}
      });

      const halState = await client.getStateForResponse('https://example.org/parent', response);
      client.cacheState(halState);
      expect(halState.uri).to.equal('https://example.org/parent');
      expect(halState.data).to.eql({item: 2});

      expect(client.cache.has('https://example.org/embedded')).to.equal(true);

      const embedded = client.cache.get('https://example.org/embedded')!;
      expect(embedded).to.be.an.instanceof(HalState);
      expect(embedded.uri).to.equal('https://example.org/embedded');
      expect(embedded.data).to.eql({item: 1});

    });

    it('should cache nested embedded resources', async() => {

      const client = new Client('https://example.org');
      const body = {
        _embedded: {
          rel: {
            _links: {
              self: { href: '/embedded'},
            },
            item: 1,
            _embedded: {
              rel: {
                _links: {
                  self: { href: '/nested'}
                },
                item: 3
              }
            },
          }
        },
        item: 2,
      };
      const response = new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/hal+json'}
      });

      const halState = await client.getStateForResponse('https://example.org/parent', response);
      client.cacheState(halState);
      expect(halState.uri).to.equal('https://example.org/parent');
      expect(halState.data).to.eql({item: 2});

      expect(client.cache.has('https://example.org/nested')).to.equal(true);

      const embedded = client.cache.get('https://example.org/nested')!;
      expect(embedded).to.be.an.instanceof(HalState);
      expect(embedded.uri).to.equal('https://example.org/nested');
      expect(embedded.data).to.eql({item: 3});

    });
  });

  it('should invalidate dependent resources if they were previously linked with "inv-by"', async () => {

    const client = new Client('https://example.org');
    client.cache.store(new BaseState({
      client,
      uri: 'https://example.org/foo',
      data: 'hello',
      headers: new Headers(),
      links: new Links('http://example.org/foo'),
    }));

    const request1 = new Request('https://example.org/foo', {
      method: 'GET',
    });

    const headers = new Headers();
    headers.append('Link', '</bar>; rel="inv-by"');
    client.use( async req => {
      return new Response('OK', { headers });
    });

    await client.fetcher.fetch(request1);
    expect(client.cache.has('https://example.org/foo')).to.equal(true);

    // Lets invalidate /bar, which should also invalidate /foo
    const request2 = new Request('https://example.org/bar', {
      method: 'PUT',
    });
    await client.fetcher.fetch(request2);

    expect(client.cache.has('https://example.org/foo')).to.equal(false);

  });

  describe('getStateForResponse', () => {

    it('should handle 204 responses', async () => {

      const client = new Client('https://example.org');
      const resp = new Response(null, {status: 204});
      const state = await client.getStateForResponse('/foo', resp);
      expect(state.uri).to.equal('/foo');

    });


  });

});
