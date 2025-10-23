import React, { useState, useEffect } from 'react'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis
} from './ui/pagination'


export default function KGPagination({
  totalRecords = 0,
  defaultPageSize = 10,
  onChangeCallback = () => {},
  className = ''
}) {
  const [pageNo, setPageNo] = useState(1)
  const [pageSize] = useState(defaultPageSize)
  const [totalPages, setTotalPages] = useState(20)

  useEffect(() => {
    // calculate total pages whenever totalRecords changes
    const pages = Math.max(1, Math.ceil(totalRecords / pageSize))
    setTotalPages(pages)

    // if total records shrink below current page, reset to 1
    if (pageNo > pages) setPageNo(1)
  }, [totalRecords, pageSize])

  useEffect(() => {
    onChangeCallback(pageNo, pageSize)
  }, [pageNo])

  const handlePageChange = (num) => {
    if (num >= 1 && num <= totalPages) {
      setPageNo(num)
    }
  }

  const visiblePages = () => {
    const delta = 2
    const range = []
    const start = Math.max(1, pageNo - delta)
    const end = Math.min(totalPages, pageNo + delta)
    for (let i = start; i <= end; i++) range.push(i)
    return range
  }

  if (totalRecords === 0) return null

  return (
    <Pagination className={`mt-4 ${className}`}>
      <PaginationContent>
        {/* Previous Button */}
        <PaginationItem>
          <PaginationPrevious
            onClick={() => handlePageChange(pageNo - 1)}
            className={pageNo === 1 ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
          />
        </PaginationItem>

        {/* First page + left ellipsis */}
        {pageNo > 3 && (
          <>
            <PaginationItem>
              <PaginationLink className="cursor-pointer" onClick={() => handlePageChange(1)}>1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          </>
        )}

        {/* Middle pages */}
        {visiblePages().map((num) => (
          <PaginationItem key={num}>
            <PaginationLink
              isActive={num === pageNo}
              className="cursor-pointer" 
              onClick={() => handlePageChange(num)}
            >
              {num}
            </PaginationLink>
          </PaginationItem>
        ))}

        {/* Right ellipsis + last page */}
        {pageNo < totalPages - 2 && (
          <>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink className="cursor-pointer"  onClick={() => handlePageChange(totalPages)}>
                {totalPages}
              </PaginationLink>
            </PaginationItem>
          </>
        )}

        {/* Next Button */}
        <PaginationItem>
          <PaginationNext
            onClick={() => handlePageChange(pageNo + 1)}
            className={pageNo === totalPages ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
