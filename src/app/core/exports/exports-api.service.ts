import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client';

@Injectable({providedIn:'root'})
export class ExportsApiService {
  private readonly api=inject(ApiClient);
  download(accountId:number,module:string,year?:number,month?:number):Observable<Blob> {
    return this.api.getBlob(`/accounts/${accountId}/exports/${module}${this.query(year,month)}`);
  }
  private query(year?:number,month?:number):string { const p=new URLSearchParams(); if(year)p.set('year',String(year)); if(month)p.set('month',String(month)); const q=p.toString(); return q?`?${q}`:''; }
}
