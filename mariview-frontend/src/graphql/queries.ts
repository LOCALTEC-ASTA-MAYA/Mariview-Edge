import { gql } from '@apollo/client';

// =====================================================
// QUERIES — aligned with BE schema.graphqls
// =====================================================

export const GET_MISSIONS = gql`
  query GetMissions($status: String) {
    getMissions(status: $status) {
      id
      missionCode
      name
      category
      status
      areaPolygon
      duration
      coverageArea
      totalDetections
      asset {
        id
        name
        type
        category
        status
        battery
      }
      pilot {
        id
        name
        role
        email
      }
      snapshots {
        id
        trackId
        classification
        confidence
        snapshotUrl
        bboxX1
        bboxY1
        bboxX2
        bboxY2
        detectedAt
      }
      startedAt
      endedAt
      createdAt
      teamMemberIds
      videoPath
    }
  }
`;

export const GET_MISSION_BY_ID = gql`
  query GetMissionById($id: ID!) {
    getMissionById(id: $id) {
      id
      missionCode
      name
      category
      status
      areaPolygon
      duration
      asset {
        id
        name
        type
        category
        status
        battery
      }
      pilot {
        id
        name
        role
        email
      }
      preFlight {
        missionId
        hullIntegrity
        sonarSystem
        batteryConn
        thruster
        depthSensor
        waterproofSeals
        navigationSystem
        communication
        verifiedAt
      }
      startedAt
      endedAt
      createdAt
    }
  }
`;

export const GET_ASSETS = gql`
  query GetAssets($category: String) {
    getAssets(category: $category) {
      id
      name
      type
      category
      status
      battery
      lastService
    }
  }
`;

export const GET_ASSET_BY_ID = gql`
  query GetAssetById($id: ID!) {
    getAssetById(id: $id) {
      id
      name
      type
      category
      status
      battery
      lastService
    }
  }
`;

export const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    getCurrentUser {
      id
      name
      role
      email
      status
    }
  }
`;

export const GET_MISSION_TELEMETRY = gql`
  query GetMissionTelemetry($missionId: ID!, $startTime: Time, $endTime: Time) {
    getMissionTelemetry(missionId: $missionId, startTime: $startTime, endTime: $endTime) {
      time
      battery
      alt
      spd
      dist
      sig
      gpsSats
      lat
      lon
    }
  }
`;

export const GET_MISSION_DETECTIONS = gql`
  query GetMissionDetections($missionId: ID!, $modelType: String) {
    getMissionDetections(missionId: $missionId, modelType: $modelType) {
      time
      flightId
      modelType
      confidence
      bboxX1
      bboxY1
      bboxX2
      bboxY2
    }
  }
`;

// =====================================================
// MUTATIONS
// =====================================================

export const CREATE_MISSION = gql`
  mutation CreateMission($input: CreateMissionInput!) {
    createMission(input: $input) {
      id
      missionCode
      name
      status
      teamMemberIds
      createdAt
    }
  }
`;

export const UPDATE_MISSION_STATUS = gql`
  mutation UpdateMissionStatus($id: ID!, $status: String!) {
    updateMissionStatus(id: $id, status: $status) {
      id
      status
    }
  }
`;

export const START_MISSION = gql`
  mutation StartMission($id: ID!) {
    startMission(id: $id) {
      id
      status
      startedAt
    }
  }
`;

export const ABORT_MISSION = gql`
  mutation AbortMission($id: ID!) {
    abortMission(id: $id) {
      id
      status
      endedAt
    }
  }
`;

export const DELETE_MISSION = gql`
  mutation DeleteMission($id: ID!) {
    deleteMission(id: $id)
  }
`;

export const DELETE_ALL_MISSIONS = gql`
  mutation DeleteAllMissions {
    deleteAllMissions
  }
`;

export const SUBMIT_PREFLIGHT_CHECK = gql`
  mutation SubmitPreFlightCheck($input: UpdatePreFlightInput!) {
    submitPreFlightCheck(input: $input) {
      missionId
      hullIntegrity
      sonarSystem
      batteryConn
      thruster
      depthSensor
      waterproofSeals
      navigationSystem
      communication
      verifiedAt
    }
  }
`;

// =====================================================
// PHASE 2 STUBS — satisfy compiler, real resolvers in Phase 2
// =====================================================

export const GET_PILOTS = gql`
  query GetPilots($role: String) {
    getPilots(role: $role) {
      id
      name
      role
      email
      status
    }
  }
`;

export const GET_DRONES = gql`
  query GetDrones {
    getAssets(category: "UAV") {
      id
      name
      type
      status
      battery
    }
  }
`;

export const GET_AIS_VESSELS = gql`
  query GetAISVessels {
    getAISVessels {
      id
      mmsi
      name
      type
      position
      speed
      course
      heading
      status
      length
    }
  }
`;

export const GET_LIVE_DRONES = gql`
  query GetLiveDrones {
    getLiveDrones {
      id
      missionId
      assetId
      flightId
      droneName
      droneType
      position
      battery
      altitude
      speed
      distance
      signal
      gpsSats
    }
  }
`;

export const GET_LIVE_FLIGHTS = gql`
  query GetLiveFlights {
    getLiveFlights {
      id
      icao24
      callsign
      aircraftType
      position
      altitude
      speed
      heading
      onGround
    }
  }
`;

export const GET_ADSB_AIRCRAFT = gql`
  query GetADSBAircraft {
    adsbAircraft: getLiveFlights {
      id
      icao24
      callsign
      name: callsign
      aircraftType
      position
      altitude
      speed
      heading
      onGround
    }
  }
`;

export const GET_WEATHER = gql`
  query GetWeather {
    getWeather {
      id
      type
      value
      unit
      position
      temp
      description
    }
  }
`;
