import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BooleanValueService {

  constructor() { }

  viewThread = signal(true);
  profileView = signal(false);
}
