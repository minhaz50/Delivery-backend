export interface IRegisterCustomerPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  /** Which courier organization this customer will ship through. */
  organizationSlug: string;
}

export interface ILoginPayload {
  email: string;
  password: string;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}
