import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import { Actions, Effect } from '@ngrx/effects';
import { Action, Store } from '@ngrx/store';
import * as queryString from 'query-string';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/skip';
import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/takeUntil';
import { Observable } from 'rxjs/Observable';
import { of } from 'rxjs/observable/of';
import * as genomes from './genomes.actions';
import { MistApi } from '../core/services/mist-api.service';
import GenomesFilter from './genomes.filter';
import { Navigation }  from '../core/common/navigation';
import { Entities } from '../core/common/entities';

@Injectable()
export class GenomesEffects {
  static DEBOUNCE_TIME_MS = 300;

  @Effect()
  search$: Observable<Action> = this.actions$
    .ofType<genomes.Search>(genomes.SEARCH)
    .debounceTime(GenomesEffects.DEBOUNCE_TIME_MS)
    .map((action) => action.payload)
    .map((query: any) => {
      const url = this.mistApi.searchGenomesWithPaginationUrl(query, Entities.GENOMES);
      return new genomes.Fetch(new Navigation(url, query.filter));
    });

  @Effect()
  getByIdList$: Observable<Action> = this.actions$
    .ofType<genomes.GetByIdList>(genomes.GETBY_ID_LIST)
    .map((action) => action.payload)
    .map((query: any) => {
      console.log("query from effects " + JSON.stringify(query) )
      const url = this.mistApi.getByIdList(query, Entities.GENOMES);
      return new genomes.Fetch(new Navigation(url, query.filter, true));
    });

  @Effect()
  fetch$: Observable<Action> = this.actions$.ofType<genomes.Fetch>(genomes.FETCH)
    .map((action) => action.payload)
    .switchMap((navigation) => {
      const nextFetch$ = this.actions$.ofType<genomes.Fetch>(genomes.FETCH).skip(1);
      return this.http.get(navigation.url)
        .takeUntil(nextFetch$)
        .map((response) => {
          const matches = response.json();
          const count = parseInt(response.headers.get('x-total-count'), 10);
          const parsed = queryString.parse(queryString.extract(navigation.url));
          const totalPages = Math.ceil(count / parsed.per_page);
          const currentPage = +parsed.page;
          let next;
          let prev;
          let first;
          let last;
          if (navigation.isGetIdList) {
            next = this.mistApi.getByIdList({search: parsed.search, perPage: parsed.per_page, pageIndex: currentPage + 1, filter: navigation.filter}, Entities.GENOMES);
            prev = this.mistApi.getByIdList({search: parsed.search, perPage: parsed.per_page, pageIndex: currentPage - 1, filter: navigation.filter}, Entities.GENOMES);
            first = this.mistApi.getByIdList({search: parsed.search, perPage: parsed.per_page, pageIndex: 1, filter: navigation.filter}, Entities.GENOMES);
            last = this.mistApi.getByIdList({search: parsed.search, perPage: parsed.per_page, pageIndex: totalPages, filter: navigation.filter}, Entities.GENOMES);
          } else {
              next = this.mistApi.searchGenomesWithPaginationUrl({search: parsed.search, perPage: parsed.per_page, pageIndex: currentPage + 1, filter: navigation.filter}, Entities.GENOMES);
              prev = this.mistApi.searchGenomesWithPaginationUrl({search: parsed.search, perPage: parsed.per_page, pageIndex: currentPage - 1, filter: navigation.filter}, Entities.GENOMES);
              first = this.mistApi.searchGenomesWithPaginationUrl({search: parsed.search, perPage: parsed.per_page, pageIndex: 1, filter: navigation.filter}, Entities.GENOMES);
              last = this.mistApi.searchGenomesWithPaginationUrl({search: parsed.search, perPage: parsed.per_page, pageIndex: totalPages, filter: navigation.filter}, Entities.GENOMES);  
          }
          const links = {first: first, last: last, next: next, prev: prev};
          return new genomes.FetchDone({
            perPage: +parsed.per_page,
            count,
            currentPage,
            totalPages,
            links,
            matches,
          });
        })
        .catch((error) => of(new genomes.FetchError(error.message)));
    });

  @Effect()
  firstPage$: Observable<Action> = this.actions$.ofType<genomes.FirstPage>(genomes.FIRST_PAGE)
    .map((action) => new genomes.Fetch(action.payload));

  @Effect()
  lastPage$: Observable<Action> = this.actions$.ofType<genomes.LastPage>(genomes.LAST_PAGE)
    .map((action) => new genomes.Fetch(action.payload)); 

  @Effect()
  prevPage$: Observable<Action> = this.actions$.ofType<genomes.PrevPage>(genomes.PREV_PAGE)
    .map((action) => new genomes.Fetch(action.payload)); 

  @Effect()
  nextPage$: Observable<Action> = this.actions$.ofType<genomes.NextPage>(genomes.NEXT_PAGE)
    .map((action) => new genomes.Fetch(action.payload)); 

  constructor(
    private http: Http,
    private actions$: Actions,
    private mistApi: MistApi,
    private store: Store<any>,
  ) {}
}
