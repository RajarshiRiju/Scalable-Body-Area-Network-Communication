
/*

This block of code can be replicated in all the instances of sensor-node

@params
node_id

Set this value to be equal to id of the node

 */


let node_id = 'node1';
context.set('id', node1);
let eResId = 'eRes' + context.get('id');
flow.set(eResId, flow.get(eResId)*0.9999 );

function getInitDiscoveryPayload() {
    return {
        from: context.get('id'),
        to: '*',
        data: {
            type: 'INIT_DISCOVERY',
            eRes: flow.get(eResId),
            sinkHops: context.get('sinkHops')
        }
    }
}

function getInitDiscoveryACKPayload(to) {
    return {
        from: context.get('id'),
        to: to,
        data: {
            type: 'ACK_DISCOVERY',
            eRes: flow.get(eResId),
            sinkHops: context.get('sinkHops')
        }
    }
}

function updateNeighborTable(payload) {
    var neighborTable = flow.get(context.get('id')) || {};
    neighborTable[payload.from] = {
        eRes: payload.data.eRes,
        sinkHops: payload.data.sinkHops
    };

    flow.set(context.get('id'), neighborTable);
}

function updateCurrentMinHop(newHops){
    var currentHop = context.get('sinkHops');
    var isUpdated = false;
    if(currentHop === -1){
        isUpdated = true;
        context.set('sinkHops', newHops);
    }else if(newHops < currentHop){
        isUpdated = true;
        context.set('sinkHops', newHops);
    }
    return isUpdated;
}

function getUpdateDistancePayload(){
    return {
        from: context.get('id'),
        to: '*',
        data: {
            type: 'UPDATE_DISTANCE',
            eRes: flow.get(eResId),
            sinkHops: context.get('sinkHops')
        }
    }
}
function calculateCost(eRes,sinkHop) {
    let cost =  (0.5*(100-eRes)/100) + (0.5*sinkHop/10);
    return cost;
};

function getNextHopId(){
    var neighborTable = flow.get(context.get('id'));

    var sortedNeighbors = Object.entries(neighborTable).sort((object1, object2) => calculateCost(object1[1].eRes , object1[1].sinkHops) - calculateCost(object2[1].eRes , object2[1].sinkHops))


    return sortedNeighbors[0][0];
}

function getForwardPayload(payload){
    return {
        from: payload.from,
        dest: payload.dest,
        to: getNextHopId(),
        path: payload.path.concat(context.get('id')),
        data: payload.data
    }
}


function computeCostAndDrainBattery() {
    flow.set(eResId, flow.get(eResId)*0.9999 );
}

function getDataPayload(){
    return {
        from: context.get('id'),
        dest: 'sink',
        to: getNextHopId(),
        path: [context.get('id')],
        data: {
            type: "FORWARD_PAYLOAD",
            value: msg.payload.data.value
        }
    }
}

var payload = {};

if (msg.payload.from === context.get('id')) {
    payload = {};
} else if (msg.payload.data.action === 'start_discovery') {
    payload = getInitDiscoveryPayload();
    context.set('sinkHops', -1);
} else if (msg.payload.data.type === 'INIT_DISCOVERY' && msg.payload.from !== context.get('id')) {
    updateNeighborTable(msg.payload)
    payload = getInitDiscoveryACKPayload(msg.payload.from);
} else if (msg.payload.data.type === 'ACK_DISCOVERY') {
    updateNeighborTable(msg.payload);

    if(msg.payload.data.isSink){
        var isUpdated = updateCurrentMinHop(1);
        if(isUpdated){
            payload = getUpdateDistancePayload();
        }
    }
} else if(msg.payload.data.type === 'UPDATE_DISTANCE'){
    updateNeighborTable(msg.payload);
    var isUpdated = updateCurrentMinHop(msg.payload.data.sinkHops + 1);
    if (isUpdated){
        payload = getUpdateDistancePayload();
    }
}
else if(msg.payload.data.type === 'FORWARD_PAYLOAD'){
    payload = getForwardPayload(msg.payload);
    computeCostAndDrainBattery();

}
else if(msg.payload.data.type === 'ACTION_GENERATE_PAYLOAD'){
    payload = getDataPayload();
}

return {
    payload
};