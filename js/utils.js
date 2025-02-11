function createTransport(data) {
  const transport = {};
  if (data.net && data.net !== 'tcp') {
    transport.type = data.net;
    if (data.path) transport.path = data.path;
    if (data.host) transport.headers = { Host: data.host };
  }
  return transport;
}
function createTransportFromParams(params) {
  const transport = {};
  const type = params.get('type');
  if (type && type !== 'tcp') {
    transport.type = type;
    if (params.get('path')) transport.path = params.get('path');
    if (params.get('host')) transport.headers = { Host: params.get('host') };
  }
  return transport;
}
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}