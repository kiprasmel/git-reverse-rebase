# TODO

- [ ] verify that `base` is committish
- [ ] --drop-file-changes (since committish)
- [ ] in `performOpDeleteFile`, batch files together by commits - reduce O(N*M) (N=`files.length`, M=`commits[i].length` for file `i`) rebases to O(max(M))
	- [ ] allow specifying `--delete-files nobatch:a,b,c,batch:d,e,f,nobatch:g,h,batch:i,j,j,l` for overriding behavior
- [ ] 
