// Packet type string constants matching SneezeBoardCommon/Messages.cs verbatim.
// NOTE: some values differ from their identifier names (e.g. DatabaseObject value
// has a literal space, UserUpdated value is "UsersUpdated"). Always use these
// constants, not string literals.
export const PT = {
  // Reserved NetworkComms.Net types
  ConnectionSetup: 'ConnectionSetup',

  // SneezeBoard messages (Messages.cs)
  DatabaseObject: 'Database object',
  Sneeze: 'Sneeze',
  AddUser: 'AddUser',
  DatabaseRequested: 'DatabaseRequested',
  DatabaseChangesRequest: 'DatabaseChangesRequest',
  UpdateUser: 'UpdateUser',
  UpdateSneeze: 'UpdateSneeze',
  RemoveSneeze: 'RemoveSneeze',
  PersonSneezed: 'PersonSneezed',
  UserUpdated: 'UsersUpdated',
  SneezeUpdated: 'SneezeUpdated',
  SneezeRemoved: 'SneezeRemoved',
} as const;
